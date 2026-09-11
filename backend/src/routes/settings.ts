import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendDueReminders } from '../lib/due-reminders';
import { generateRecurringInvoices } from '../lib/recurring-billing';

const router = Router();

// ── Validation ─────────────────────────────────────────────────────────────
// Per-society settings. Only dueReminderDays exists today (Phase 7 slice 2);
// add future settings here as new optional fields.
const UpdateSettingsSchema = z.object({
  dueReminderDays: z.number().int().min(1).max(30, 'Reminder window must be between 1 and 30 days').optional(),
  billingDayOfMonth: z.number().int().min(1).max(28, 'Billing day must be between 1 and 28').nullable().optional(),
});

type SocietySettings = {
  dueReminderDays: number;
  billingDayOfMonth: number | null;
};

async function getSocietySettings(societyId: string): Promise<SocietySettings> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { dueReminderDays: true, billingDayOfMonth: true },
  });
  if (!society) {
    throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Society not found');
  }
  return { dueReminderDays: society.dueReminderDays, billingDayOfMonth: society.billingDayOfMonth };
}

// ── GET /api/v1/settings ───────────────────────────────────────────────────
// Read society settings. Any active member (resident included) may read them;
// only admins may change them (see PATCH).
router.get(
  '/',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }
      sendSuccess(res, await getSocietySettings(societyId));
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/v1/settings ─────────────────────────────────────────────────
// Admin updates society settings (e.g. how many days before the due date the
// automated dues reminder fires).
router.patch(
  '/',
  requireAuth,
  loadMembership,
  requireRole('update', 'society'),
  async (req, res, next) => {
    try {
      const input = UpdateSettingsSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const before = await getSocietySettings(societyId);
      const updateData: any = {};
      if (input.dueReminderDays !== undefined) updateData.dueReminderDays = input.dueReminderDays;
      if (input.billingDayOfMonth !== undefined) updateData.billingDayOfMonth = input.billingDayOfMonth;

      const society = await prisma.society.update({
        where: { id: societyId },
        data: updateData,
        select: { dueReminderDays: true, billingDayOfMonth: true },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'SOCIETY_SETTINGS_UPDATED',
        entityType: 'society',
        entityId: societyId,
        before: before,
        after: { dueReminderDays: society.dueReminderDays, billingDayOfMonth: society.billingDayOfMonth },
      });

      sendSuccess(res, { dueReminderDays: society.dueReminderDays, billingDayOfMonth: society.billingDayOfMonth });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/settings/run-reminders ────────────────────────────────────
// Admin-only manual trigger so the feature can be exercised without waiting
// for the daily cron. Scoped to the caller's own society (tenant-safe); the
// scheduled job scans all societies.
router.post(
  '/run-reminders',
  requireAuth,
  loadMembership,
  requireRole('update', 'society'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const result = await sendDueReminders(new Date(), societyId);

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'DUE_REMINDERS_MANUALLY_RUN',
        entityType: 'society',
        entityId: societyId,
        after: { reminded: result.reminded },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/settings/run-billing ──────────────────────────────────────
// Admin-only manual trigger for recurring billing generation.
router.post(
  '/run-billing',
  requireAuth,
  loadMembership,
  requireRole('update', 'society'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const result = await generateRecurringInvoices(new Date(), societyId);

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'RECURRING_BILLING_MANUALLY_RUN',
        entityType: 'society',
        entityId: societyId,
        after: { created: result.created, skipped: result.skipped, errors: result.errors.length },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
