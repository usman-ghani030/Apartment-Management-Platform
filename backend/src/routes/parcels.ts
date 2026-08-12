import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendNotification } from '../lib/notifications';
import { CreateParcelSchema, UpdateParcelSchema } from '@apartment/shared';
import type { ParcelResponse } from '@apartment/shared';

const router = Router();

// ── Helper: get user's unit IDs in a society ───────────────────────────────
async function getUserUnitIds(userId: string, societyId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, societyId, status: 'ACTIVE', deletedAt: null, unitId: { not: null } },
    select: { unitId: true },
  });
  return memberships.map((m) => m.unitId).filter(Boolean) as string[];
}

// ── Helper: format parcel for response ─────────────────────────────────────
function formatParcel(p: any): ParcelResponse {
  return {
    id: p.id, societyId: p.societyId, unitId: p.unitId,
    unitNumber: p.unit?.unitNumber || '',
    loggedByUserId: p.loggedByUserId,
    loggedByUserName: p.loggedByUser?.name || '',
    collectedByUserId: p.collectedByUserId || null,
    collectedByUserName: p.collectedByUser?.name || null,
    description: p.description, photoUrl: p.photoUrl || null,
    status: p.status, createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const parcelInclude = {
  unit: { select: { unitNumber: true } },
  loggedByUser: { select: { name: true } },
  collectedByUser: { select: { name: true } },
} as const;

// ── GET /api/v1/parcels — list parcels ─────────────────────────────────────
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdminOrGuard = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN' || role === 'SECURITY_GUARD';
    const status = req.query.status as string | undefined;

    const where: any = { societyId, deletedAt: null };
    if (!isAdminOrGuard) {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (unitIds.length > 0) {
        where.unitId = { in: unitIds };
      } else {
        sendSuccess(res, []);
        return;
      }
    }
    if (status) where.status = status;

    const parcels = await prisma.parcel.findMany({
      where,
      include: parcelInclude,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, parcels.map(formatParcel));
  } catch (err) { next(err); }
});

// ── POST /api/v1/parcels — log a new parcel arrival ────────────────────────
router.post('/', requireAuth, loadMembership, requireRole('create', 'parcel'), async (req, res, next) => {
  try {
    const input = CreateParcelSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    // Verify unit belongs to this society
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, societyId } });
    if (!unit) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found in this society');

    const parcel = await prisma.parcel.create({
      data: {
        societyId, unitId: input.unitId, loggedByUserId: req.user!.id,
        description: input.description, photoUrl: input.photoUrl || null,
      },
      include: parcelInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'PARCEL_ARRIVED',
      entityType: 'parcel', entityId: parcel.id,
      after: { description: input.description, unitId: input.unitId },
    });

    // Notify resident that a parcel arrived
    await sendNotification({
      type: 'PARCEL_ARRIVED', parcelId: parcel.id,
      societyId, unitId: input.unitId, description: input.description,
    });

    sendSuccess(res, formatParcel(parcel), 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/parcels/:id — view a single parcel ────────────────────────
router.get('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const parcel = await prisma.parcel.findFirst({
      where: { id: req.params.id, societyId },
      include: parcelInclude,
    });
    if (!parcel) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Parcel not found');

    // Residents can only see their own parcels
    const role = req.membership!.role;
    if (role === 'RESIDENT') {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (!unitIds.includes(parcel.unitId)) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    }

    sendSuccess(res, formatParcel(parcel));
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/parcels/:id — update parcel (mark collected) ────────────
router.patch('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const input = UpdateParcelSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';

    const existing = await prisma.parcel.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Parcel not found');

    // Residents can only update their own parcels
    if (role === 'RESIDENT') {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (!unitIds.includes(existing.unitId)) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    }

    // Guard: prevent reverting from COLLECTED back to ARRIVED
    if (existing.status === 'COLLECTED' && input.status === 'ARRIVED') {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'Cannot revert a collected parcel back to arrived');
    }

    const updateData: any = { ...input };
    if (input.photoUrl === null) updateData.photoUrl = null;

    // If marking as collected, record who collected it
    if (input.status === 'COLLECTED' && existing.status === 'ARRIVED') {
      updateData.collectedByUserId = req.user!.id;
    }

    const updated = await prisma.parcel.update({
      where: { id: req.params.id },
      data: updateData,
      include: parcelInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'PARCEL_UPDATED',
      entityType: 'parcel', entityId: updated.id,
      before: { status: existing.status }, after: { status: updated.status },
    });

    sendSuccess(res, formatParcel(updated));
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/parcels/:id — soft-delete a parcel ─────────────────────
router.delete('/:id', requireAuth, loadMembership, requireRole('delete', 'parcel'), async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const existing = await prisma.parcel.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Parcel not found');

    await prisma.parcel.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'PARCEL_DELETED',
      entityType: 'parcel', entityId: req.params.id,
      before: { status: existing.status },
    });

    sendSuccess(res, { message: 'Parcel deleted' });
  } catch (err) { next(err); }
});

export default router;
