import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { randomUUID } from 'crypto';
import { CreateVisitorPassSchema, UpdateVisitorPassSchema } from '@apartment/shared';
import type { VisitorPassResponse, GateLogResponse } from '@apartment/shared';

const router = Router();

/**
 * Get the unit IDs that a user belongs to in a given society.
 */
async function getUserUnitIds(userId: string, societyId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, societyId, status: 'ACTIVE', deletedAt: null, unitId: { not: null } },
    select: { unitId: true },
  });
  return memberships.map((m) => m.unitId).filter(Boolean) as string[];
}

// ── Helper: generate unique QR token ───────────────────────────────────────
function generateQrToken(): string {
  return `VP-${randomUUID().split('-').join('').slice(0, 16).toUpperCase()}`;
}

// ── Helper: format visitor pass for response ───────────────────────────────
function formatPass(p: any): VisitorPassResponse {
  return {
    id: p.id, societyId: p.societyId, unitId: p.unitId, unitNumber: p.unit?.unitNumber || '',
    residentId: p.residentId, residentName: p.resident?.name || '',
    visitorName: p.visitorName, visitorPhone: p.visitorPhone,
    visitorEmail: p.visitorEmail || null, vehicleNumber: p.vehicleNumber || null,
    purpose: p.purpose || null,
    expectedArrival: p.expectedArrival?.toISOString() || null,
    expectedDeparture: p.expectedDeparture?.toISOString() || null,
    status: p.status, qrToken: p.qrToken,
    approvedAt: p.approvedAt?.toISOString() || null,
    expiresAt: p.expiresAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

const passInclude = {
  unit: { select: { unitNumber: true } },
  resident: { select: { name: true } },
} as const;

// ── GET /api/v1/visitors — list visitor passes ────────────────────────────
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN' || role === 'SECURITY_GUARD';
    const status = req.query.status as string | undefined;

    const where: any = { societyId, deletedAt: null };
    if (!isAdmin) {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (unitIds.length > 0) {
        where.unitId = { in: unitIds };
      } else {
        sendSuccess(res, []);
        return;
      }
    }
    if (status) where.status = status;

    const passes = await prisma.visitorPass.findMany({
      where,
      include: passInclude,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, passes.map(formatPass));
  } catch (err) { next(err); }
});

// ── POST /api/v1/visitors — create visitor pass (resident) ────────────────
router.post('/', requireAuth, loadMembership, requireRole('create', 'visitor'), async (req, res, next) => {
  try {
    const input = CreateVisitorPassSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    // Look up unit from DB (defensive — not relying on req.membership.unitId)
    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    if (unitIds.length === 0) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'You must have a unit assigned to create visitor passes');
    const unitId = unitIds[0];

    const qrToken = generateQrToken();
    // Auto-set expires to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const pass = await prisma.visitorPass.create({
      data: {
        societyId, unitId, residentId: req.user!.id,
        qrToken, expiresAt,
        visitorName: input.visitorName,
        visitorPhone: input.visitorPhone,
        visitorEmail: input.visitorEmail || null,
        vehicleNumber: input.vehicleNumber || null,
        purpose: input.purpose || null,
        expectedArrival: input.expectedArrival ? new Date(input.expectedArrival) : null,
        expectedDeparture: input.expectedDeparture ? new Date(input.expectedDeparture) : null,
      },
      include: passInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'VISITOR_PASS_CREATED',
      entityType: 'visitor_pass', entityId: pass.id,
      after: { visitorName: input.visitorName, unitId },
    });

    sendSuccess(res, formatPass(pass), 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/visitors/:id — view a single visitor pass ─────────────────
router.get('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
    const pass = await prisma.visitorPass.findFirst({
      where: { id: req.params.id, societyId },
      include: passInclude,
    });
    if (!pass) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Visitor pass not found');
    sendSuccess(res, formatPass(pass));
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/visitors/:id — update visitor pass ──────────────────────
router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'visitor'), async (req, res, next) => {
  try {
    const input = UpdateVisitorPassSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';

    const existing = await prisma.visitorPass.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Visitor pass not found');
    if (!isAdmin) {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (!unitIds.includes(existing.unitId)) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    }

    const updateData: any = { ...input };
    if (input.visitorEmail === '') updateData.visitorEmail = null;
    if (input.vehicleNumber === '') updateData.vehicleNumber = null;
    if (input.purpose === '') updateData.purpose = null;
    if (input.expectedArrival) updateData.expectedArrival = new Date(input.expectedArrival);
    if (input.expectedDeparture) updateData.expectedDeparture = new Date(input.expectedDeparture);

    // If approving a pass
    if (input.status === 'APPROVED' && existing.status === 'PENDING') {
      updateData.approvedAt = new Date();
    }
    // If cancelling
    if (input.status === 'CANCELLED') {
      // Any status can be cancelled
    }

    const updated = await prisma.visitorPass.update({
      where: { id: req.params.id },
      data: updateData,
      include: passInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'VISITOR_PASS_UPDATED',
      entityType: 'visitor_pass', entityId: updated.id,
      before: { status: existing.status }, after: { status: updated.status },
    });

    sendSuccess(res, formatPass(updated));
  } catch (err) { next(err); }
});

// ── POST /api/v1/visitors/verify/:qrToken — verify QR code at gate ───────
router.post('/verify/:qrToken', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isGuard = role === 'SECURITY_GUARD' || role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
    if (!isGuard) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Only security guards and admins can verify passes');

    const pass = await prisma.visitorPass.findFirst({
      where: { qrToken: req.params.qrToken, societyId },
      include: passInclude,
    });
    if (!pass) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invalid QR code — visitor pass not found');
    if (pass.deletedAt) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'This pass has been deleted');
    if (pass.status === 'CANCELLED') throw new AppError(ErrorCodes.CONFLICT, 409, 'This pass has been cancelled');
    if (pass.status === 'EXPIRED' || (pass.expiresAt && pass.expiresAt < new Date())) throw new AppError(ErrorCodes.CONFLICT, 409, 'This pass has expired');
    if (pass.status === 'CHECKED_OUT') throw new AppError(ErrorCodes.CONFLICT, 409, 'Visitor has already checked out');

    // Auto-approve if still pending
    if (pass.status === 'PENDING') {
      await prisma.visitorPass.update({
        where: { id: pass.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
    }

    sendSuccess(res, formatPass(pass));
  } catch (err) { next(err); }
});

// ── POST /api/v1/visitors/:id/gate — log gate entry/exit ──────────────────
router.post('/:id/gate', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const { action: rawAction, notes } = req.body as { action: string; notes?: string };
    if (!rawAction || !['ENTRY', 'EXIT'].includes(rawAction)) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Action must be ENTRY or EXIT');
    const action = rawAction as 'ENTRY' | 'EXIT';

    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isGuard = role === 'SECURITY_GUARD' || role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
    if (!isGuard) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Only security guards and admins can log gate events');

    const pass = await prisma.visitorPass.findFirst({
      where: { id: req.params.id, societyId },
      include: passInclude,
    });
    if (!pass) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Visitor pass not found');

    if (action === 'ENTRY' && pass.status !== 'APPROVED' && pass.status !== 'PENDING') {
      throw new AppError(ErrorCodes.CONFLICT, 409, `Cannot check in — pass is ${pass.status.toLowerCase()}`);
    }
    if (action === 'EXIT' && pass.status !== 'CHECKED_IN') {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'Cannot check out — visitor is not checked in');
    }

    // Create gate log entry
    const gateLog = await prisma.gateLog.create({
      data: {
        societyId, visitorPassId: pass.id, unitId: pass.unitId,
        action, guardId: req.user!.id, notes: notes || null,
      },
    });

    // Update visitor pass status
    const newStatus = action === 'ENTRY' ? 'CHECKED_IN' : 'CHECKED_OUT';
    await prisma.visitorPass.update({
      where: { id: pass.id },
      data: { status: newStatus },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: `GATE_${action}`,
      entityType: 'visitor_pass', entityId: pass.id,
      after: { action, status: newStatus },
    });

    sendSuccess(res, {
      id: gateLog.id, societyId: gateLog.societyId,
      visitorPassId: gateLog.visitorPassId,
      unitId: gateLog.unitId, unitNumber: pass.unit?.unitNumber || '',
      visitorName: pass.visitorName,
      action: gateLog.action as import('@apartment/shared').GateLogAction,
      guardId: gateLog.guardId, guardName: req.user!.name,
      notes: gateLog.notes, createdAt: gateLog.createdAt.toISOString(),
    } as GateLogResponse, 201);
  } catch (err) { next(err); }
});

// ── POST /api/v1/visitors/:id/cancel — cancel a visitor pass ──────────────
router.post('/:id/cancel', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';

    const pass = await prisma.visitorPass.findFirst({ where: { id: req.params.id, societyId } });
    if (!pass) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Visitor pass not found');
    if (!isAdmin) {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (!unitIds.includes(pass.unitId)) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    }
    if (!['PENDING', 'APPROVED'].includes(pass.status)) throw new AppError(ErrorCodes.CONFLICT, 409, `Cannot cancel a ${pass.status.toLowerCase()} pass`);

    await prisma.visitorPass.update({
      where: { id: pass.id },
      data: { status: 'CANCELLED' },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'VISITOR_PASS_CANCELLED',
      entityType: 'visitor_pass', entityId: pass.id,
      before: { status: pass.status }, after: { status: 'CANCELLED' },
    });

    sendSuccess(res, { message: 'Visitor pass cancelled' });
  } catch (err) { next(err); }
});

export default router;
