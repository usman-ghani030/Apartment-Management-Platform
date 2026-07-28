import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { AppError, ErrorCodes } from '../lib/app-error';

const router = Router();

// ── GET /api/v1/units ──────────────────────────────────────────────────────
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const units = await prisma.unit.findMany({
      where: { societyId, deletedAt: null },
      include: {
        building: { select: { name: true } },
        _count: { select: { memberships: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
      orderBy: [{ building: { name: 'asc' } }, { floor: 'asc' }, { unitNumber: 'asc' }],
    });
    sendSuccess(res, units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      floor: u.floor,
      type: u.type,
      buildingId: u.buildingId,
      buildingName: u.building.name,
      residentCount: u._count.memberships,
    })));
  } catch (err) { next(err); }
});

// ── POST /api/v1/units ────────────────────────────────────────────────────
const CreateUnitSchema = z.object({
  buildingId: z.string().uuid(),
  unitNumber: z.string().min(1).max(20),
  floor: z.number().int().min(0),
  type: z.enum(['OWNER_OCCUPIED', 'RENTED', 'VACANT']).default('VACANT'),
});

router.post('/', requireAuth, loadMembership, requireRole('create', 'unit'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const input = CreateUnitSchema.parse(req.body);

    // Verify building belongs to this society
    const building = await prisma.building.findFirst({ where: { id: input.buildingId, societyId, deletedAt: null } });
    if (!building) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Building not found in this society');

    const unit = await prisma.unit.create({
      data: {
        unitNumber: input.unitNumber,
        floor: input.floor,
        type: input.type,
        buildingId: input.buildingId,
        societyId,
      },
    });

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'UNIT_CREATED',
      entityType: 'unit',
      entityId: unit.id,
      after: { unitNumber: unit.unitNumber, buildingId: building.name, floor: unit.floor },
    });

    sendSuccess(res, { id: unit.id, unitNumber: unit.unitNumber, floor: unit.floor, type: unit.type, buildingId: unit.buildingId }, 201);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/units/:id ───────────────────────────────────────────────
const UpdateUnitSchema = z.object({
  unitNumber: z.string().min(1).max(20).optional(),
  floor: z.number().int().min(0).optional(),
  type: z.enum(['OWNER_OCCUPIED', 'RENTED', 'VACANT']).optional(),
  buildingId: z.string().uuid().optional(),
});

router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'unit'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const input = UpdateUnitSchema.parse(req.body);

    const existing = await prisma.unit.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found');

    // If changing building, verify it exists in this society
    if (input.buildingId) {
      const building = await prisma.building.findFirst({ where: { id: input.buildingId, societyId, deletedAt: null } });
      if (!building) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Building not found in this society');
    }

    const updated = await prisma.unit.update({
      where: { id: req.params.id },
      data: input,
    });

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'UNIT_UPDATED',
      entityType: 'unit',
      entityId: updated.id,
      before: { unitNumber: existing.unitNumber },
      after: { unitNumber: updated.unitNumber },
    });

    sendSuccess(res, { id: updated.id, unitNumber: updated.unitNumber, floor: updated.floor, type: updated.type, buildingId: updated.buildingId });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/units/:id ──────────────────────────────────────────────
router.delete('/:id', requireAuth, loadMembership, requireRole('delete', 'unit'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const existing = await prisma.unit.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found');

    // Check if unit has active residents
    const residentCount = await prisma.membership.count({ where: { unitId: req.params.id, status: 'ACTIVE', deletedAt: null } });
    if (residentCount > 0) {
      throw new AppError(ErrorCodes.CONFLICT, 409, `Cannot delete unit with ${residentCount} active resident(s). Remove residents first.`);
    }

    await prisma.unit.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'UNIT_DELETED',
      entityType: 'unit',
      entityId: req.params.id,
      before: { unitNumber: existing.unitNumber },
    });

    sendSuccess(res, { message: 'Unit deleted' });
  } catch (err) { next(err); }
});

export default router;
