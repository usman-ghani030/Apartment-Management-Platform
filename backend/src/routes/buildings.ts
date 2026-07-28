import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { AppError, ErrorCodes } from '../lib/app-error';

const router = Router();

// ── GET /api/v1/buildings ─────────────────────────────────────────────────
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const buildings = await prisma.building.findMany({
      where: { societyId, deletedAt: null },
      include: { _count: { select: { units: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, buildings.map((b) => ({ id: b.id, name: b.name, unitCount: b._count.units, createdAt: b.createdAt.toISOString() })));
  } catch (err) { next(err); }
});

// ── POST /api/v1/buildings ────────────────────────────────────────────────
const CreateBuildingSchema = z.object({ name: z.string().min(1).max(100) });

router.post('/', requireAuth, loadMembership, requireRole('create', 'building'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const input = CreateBuildingSchema.parse(req.body);

    const building = await prisma.building.create({
      data: { name: input.name, societyId },
    });

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'BUILDING_CREATED',
      entityType: 'building',
      entityId: building.id,
      after: { name: building.name },
    });

    sendSuccess(res, { id: building.id, name: building.name }, 201);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/buildings/:id ───────────────────────────────────────────
const UpdateBuildingSchema = z.object({ name: z.string().min(1).max(100) });

router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'building'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const input = UpdateBuildingSchema.parse(req.body);

    const existing = await prisma.building.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Building not found');

    const updated = await prisma.building.update({
      where: { id: req.params.id },
      data: { name: input.name },
    });

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'BUILDING_UPDATED',
      entityType: 'building',
      entityId: updated.id,
      before: { name: existing.name },
      after: { name: updated.name },
    });

    sendSuccess(res, { id: updated.id, name: updated.name });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/buildings/:id ──────────────────────────────────────────
router.delete('/:id', requireAuth, loadMembership, requireRole('delete', 'building'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const existing = await prisma.building.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Building not found');

    // Check if building has units
    const unitCount = await prisma.unit.count({ where: { buildingId: req.params.id, deletedAt: null } });
    if (unitCount > 0) {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'Cannot delete building with existing units. Remove or reassign units first.');
    }

    await prisma.building.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'BUILDING_DELETED',
      entityType: 'building',
      entityId: req.params.id,
      before: { name: existing.name },
    });

    sendSuccess(res, { message: 'Building deleted' });
  } catch (err) { next(err); }
});

export default router;
