import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess, sendPaginated } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendNotification } from '../lib/notifications';
import { TriggerSOSSchema, ResolveSOSSchema } from '@apartment/shared';
import type { SOSAlertResponse } from '@apartment/shared';

const router = Router();

function formatSOSAlert(alert: any): SOSAlertResponse {
  return {
    id: alert.id,
    societyId: alert.societyId,
    unitId: alert.unitId,
    unitNumber: alert.unit?.unitNumber ?? 'Unknown',
    residentId: alert.residentId,
    residentName: alert.resident?.name ?? 'Unknown',
    category: alert.category,
    status: alert.status,
    notes: alert.notes ?? null,
    resolvedByUserId: alert.resolvedByUserId ?? null,
    resolvedByName: alert.resolvedBy?.name ?? null,
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

// ── POST /api/v1/sos-alerts ───────────────────────────────────────────────
// Resident triggers an SOS alert
router.post(
  '/',
  requireAuth,
  loadMembership,
  requireRole('create', 'sos_alert'),
  async (req, res, next) => {
    try {
      const input = TriggerSOSSchema.parse(req.body);
      const societyId = req.membership!.societyId;
      const userId = req.user!.id;

      // Verify the unit belongs to this society
      const unit = await prisma.unit.findFirst({
        where: { id: input.unitId, societyId, deletedAt: null },
      });
      if (!unit) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found');
      }

      // Create the SOS alert
      const alert = await prisma.sOSAlert.create({
        data: {
          societyId,
          unitId: input.unitId,
          residentId: userId,
          category: input.category,
          status: 'ACTIVE',
        },
        include: {
          unit: { select: { unitNumber: true } },
          resident: { select: { name: true } },
        },
      });

      // Audit log — safety-critical, log thoroughly
      await logAudit({
        societyId,
        actorUserId: userId,
        action: 'SOS_ALERT_TRIGGERED',
        entityType: 'sos_alert',
        entityId: alert.id,
        after: {
          unitId: input.unitId,
          unitNumber: unit.unitNumber,
          category: input.category,
          residentName: req.user!.name,
        },
      });

      // Send notification event
      await sendNotification({
        type: 'SOS_ALERT_TRIGGERED',
        sosAlertId: alert.id,
        societyId,
        unitId: input.unitId,
        residentId: userId,
        category: input.category,
      });

      // Notify all active Committee Admins for this society
      const adminMemberships = await prisma.membership.findMany({
        where: {
          societyId,
          role: { in: ['COMMITTEE_ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: { user: { select: { name: true, email: true } } },
      });

      for (const admin of adminMemberships) {
        console.log(
          `[SOS] Notifying admin ${admin.user.name} (${admin.user.email}) — ` +
          `${input.category} alert from Unit ${unit.unitNumber} by ${req.user!.name}`
        );
      }

      // Notify active Guard staff
      const guardStaff = await prisma.staff.findMany({
        where: {
          societyId,
          role: 'GUARD',
          isActive: true,
          deletedAt: null,
        },
      });

      for (const guard of guardStaff) {
        console.log(
          `[SOS] Notifying guard ${guard.name} (${guard.phone ?? guard.email ?? 'no contact'}) — ` +
          `${input.category} alert from Unit ${unit.unitNumber}`
        );
      }

      sendSuccess(res, formatSOSAlert(alert), 201);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/sos-alerts ────────────────────────────────────────────────
// Admin lists all SOS alerts for the society
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'sos_alert'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const status = req.query.status as string | undefined;
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const where: any = { societyId };
      if (status && ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
        where.status = status;
      }
      if (cursor) {
        where.createdAt = { lt: new Date(cursor) };
      }

      const alerts = await prisma.sOSAlert.findMany({
        where,
        include: {
          unit: { select: { unitNumber: true } },
          resident: { select: { name: true } },
          resolvedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = alerts.length > limit;
      const data = alerts.slice(0, limit).map(formatSOSAlert);
      const nextCursor = hasMore ? data[data.length - 1].createdAt : null;

      sendPaginated(res, data, nextCursor);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/sos-alerts/active-count ────────────────────────────────────
// Quick count of active alerts for dashboard badge
router.get(
  '/active-count',
  requireAuth,
  loadMembership,
  requireRole('read', 'sos_alert'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const count = await prisma.sOSAlert.count({
        where: { societyId, status: 'ACTIVE' },
      });

      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/sos-alerts/:id ────────────────────────────────────────────
// Admin gets a single SOS alert
router.get(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('read', 'sos_alert'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const alert = await prisma.sOSAlert.findFirst({
        where: { id: req.params.id, societyId },
        include: {
          unit: { select: { unitNumber: true } },
          resident: { select: { name: true, email: true } },
          resolvedBy: { select: { name: true } },
        },
      });

      if (!alert) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'SOS alert not found');
      }

      sendSuccess(res, formatSOSAlert(alert));
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/v1/sos-alerts/:id ──────────────────────────────────────────
// Admin acknowledges or resolves an SOS alert
router.patch(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('update', 'sos_alert'),
  async (req, res, next) => {
    try {
      const input = ResolveSOSSchema.parse(req.body);
      const societyId = req.membership!.societyId;
      const userId = req.user!.id;

      const existing = await prisma.sOSAlert.findFirst({
        where: { id: req.params.id, societyId },
        include: {
          unit: { select: { unitNumber: true } },
          resident: { select: { name: true } },
        },
      });
      if (!existing) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'SOS alert not found');
      }

      const updateData: any = {
        status: input.status,
      };
      if (input.notes) updateData.notes = input.notes;
      if (input.status === 'RESOLVED') {
        updateData.resolvedByUserId = userId;
        updateData.resolvedAt = new Date();
      }

      const alert = await prisma.sOSAlert.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          unit: { select: { unitNumber: true } },
          resident: { select: { name: true } },
          resolvedBy: { select: { name: true } },
        },
      });

      const action = input.status === 'RESOLVED' ? 'SOS_ALERT_RESOLVED' : 'SOS_ALERT_ACKNOWLEDGED';
      await logAudit({
        societyId,
        actorUserId: userId,
        action,
        entityType: 'sos_alert',
        entityId: alert.id,
        before: { status: existing.status },
        after: {
          status: alert.status,
          notes: input.notes,
          unitNumber: existing.unit.unitNumber,
          residentName: existing.resident.name,
        },
      });

      await sendNotification({
        type: input.status === 'RESOLVED' ? 'SOS_ALERT_RESOLVED' : 'SOS_ALERT_ACKNOWLEDGED',
        sosAlertId: alert.id,
        societyId,
        acknowledgedBy: userId,
        resolvedBy: userId,
      });

      sendSuccess(res, formatSOSAlert(alert));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
