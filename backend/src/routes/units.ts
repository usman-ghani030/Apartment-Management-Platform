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
        memberships: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true } } },
          take: 1,
        },
      },
      orderBy: [{ building: { name: 'asc' } }, { floor: 'asc' }, { unitNumber: 'asc' }],
    });
    sendSuccess(res, units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      floor: u.floor,
      type: u.type,
      bedroomType: u.bedroomType,
      buildingId: u.buildingId,
      buildingName: u.building.name,
      residentCount: u._count.memberships,
      primaryContactName: u.primaryContactName,
      // Occupant summary: linked resident name if present, else primary contact name, else null
      occupantName: u.memberships[0]?.user?.name || u.primaryContactName || null,
      hasLinkedResident: u.memberships.length > 0,
    })));
  } catch (err) { next(err); }
});

// ── POST /api/v1/units ────────────────────────────────────────────────────
const CreateUnitSchema = z.object({
  buildingId: z.string().uuid(),
  unitNumber: z.string().min(1).max(20),
  floor: z.number().int().min(0).max(500, 'Floor must be between 0 and 500'),
  type: z.enum(['OWNER_OCCUPIED', 'RENTED', 'VACANT']).default('VACANT'),
  bedroomType: z.enum(['STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'FOUR_BED', 'FOUR_PLUS_BED']).optional().nullable(),
  primaryContactName: z.string().min(1).max(100).optional().nullable(),
  primaryContactEmail: z.string().email('Enter a valid email address').max(200).optional().nullable(),
  primaryContactPhone: z.string().max(30).optional().nullable(),
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
        bedroomType: input.bedroomType,
        primaryContactName: input.primaryContactName,
        primaryContactEmail: input.primaryContactEmail,
        primaryContactPhone: input.primaryContactPhone,
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
      after: { unitNumber: unit.unitNumber, buildingName: building.name, floor: unit.floor, bedroomType: unit.bedroomType },
    });

    sendSuccess(res, {
      id: unit.id,
      unitNumber: unit.unitNumber,
      floor: unit.floor,
      type: unit.type,
      bedroomType: unit.bedroomType,
      primaryContactName: unit.primaryContactName,
      primaryContactEmail: unit.primaryContactEmail,
      primaryContactPhone: unit.primaryContactPhone,
      buildingId: unit.buildingId,
    }, 201);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/units/:id ───────────────────────────────────────────────
const UpdateUnitSchema = z.object({
  unitNumber: z.string().min(1).max(20).optional(),
  floor: z.number().int().min(0).max(500, 'Floor must be between 0 and 500').optional(),
  type: z.enum(['OWNER_OCCUPIED', 'RENTED', 'VACANT']).optional(),
  buildingId: z.string().uuid().optional(),
  bedroomType: z.enum(['STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'FOUR_BED', 'FOUR_PLUS_BED']).optional().nullable(),
  primaryContactName: z.string().min(1).max(100).optional().nullable(),
  primaryContactEmail: z.string().email('Enter a valid email address').max(200).optional().nullable(),
  primaryContactPhone: z.string().max(30).optional().nullable(),
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
      before: { unitNumber: existing.unitNumber, bedroomType: existing.bedroomType },
      after: { unitNumber: updated.unitNumber, bedroomType: updated.bedroomType },
    });

    sendSuccess(res, {
      id: updated.id,
      unitNumber: updated.unitNumber,
      floor: updated.floor,
      type: updated.type,
      bedroomType: updated.bedroomType,
      primaryContactName: updated.primaryContactName,
      primaryContactEmail: updated.primaryContactEmail,
      primaryContactPhone: updated.primaryContactPhone,
      buildingId: updated.buildingId,
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/units/:id/transfer-check ──────────────────────────────────
// Check if all invoices are paid before a unit transfer/move-out
router.get('/:id/transfer-check', requireAuth, loadMembership, requireRole('read', 'unit'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const unit = await prisma.unit.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!unit) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found');

    // Find all unpaid invoices (ISSUED, OVERDUE, DISPUTED - not PAID, CANCELLED, DRAFT)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        unitId: req.params.id,
        deletedAt: null,
        status: { in: ['ISSUED', 'OVERDUE', 'DISPUTED'] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        amount: true,
        status: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Get active memberships for this unit
    const activeMembers = await prisma.membership.findMany({
      where: { unitId: req.params.id, status: 'ACTIVE', deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const canTransfer = unpaidInvoices.length === 0;

    sendSuccess(res, {
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      canTransfer,
      unpaidInvoices,
      unpaidCount: unpaidInvoices.length,
      unpaidTotal: unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      activeMembers: activeMembers.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      primaryContactName: unit.primaryContactName,
      primaryContactEmail: unit.primaryContactEmail,
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/units/:id/complete-transfer ───────────────────────────────
// Complete a unit transfer/move-out - deactivates memberships, clears contacts
router.post('/:id/complete-transfer', requireAuth, loadMembership, requireRole('update', 'unit'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const userId = req.user!.id;

    const unit = await prisma.unit.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!unit) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found');

    // Re-check unpaid invoices (safety gate)
    const unpaidCount = await prisma.invoice.count({
      where: {
        unitId: req.params.id,
        deletedAt: null,
        status: { in: ['ISSUED', 'OVERDUE', 'DISPUTED'] },
      },
    });
    if (unpaidCount > 0) {
      throw new AppError(ErrorCodes.CONFLICT, 409, `Cannot complete transfer: ${unpaidCount} unpaid invoice(s) remain. All dues must be settled first.`);
    }

    // Capture before state for audit
    const activeMembers = await prisma.membership.findMany({
      where: { unitId: req.params.id, status: 'ACTIVE', deletedAt: null },
      include: { user: { select: { name: true } } },
    });

    // Deactivate all active memberships for this unit
    await prisma.membership.updateMany({
      where: { unitId: req.params.id, status: 'ACTIVE', deletedAt: null },
      data: { status: 'REVOKED', deletedAt: new Date() },
    });

    // Clear primary contact fields
    await prisma.unit.update({
      where: { id: req.params.id },
      data: {
        primaryContactName: null,
        primaryContactEmail: null,
        primaryContactPhone: null,
      },
    });

    // Comprehensive audit log - safety-critical data
    await logAudit({
      societyId,
      actorUserId: userId,
      action: 'UNIT_TRANSFER_COMPLETED',
      entityType: 'unit',
      entityId: req.params.id,
      before: {
        unitNumber: unit.unitNumber,
        primaryContactName: unit.primaryContactName,
        primaryContactEmail: unit.primaryContactEmail,
        primaryContactPhone: unit.primaryContactPhone,
        deactivatedMembers: activeMembers.map((m) => ({
          name: m.user.name,
          role: m.role,
          membershipId: m.id,
        })),
      },
      after: {
        unitNumber: unit.unitNumber,
        primaryContactName: null,
        primaryContactEmail: null,
        primaryContactPhone: null,
        deactivatedCount: activeMembers.length,
      },
    });

    sendSuccess(res, {
      message: 'Transfer completed successfully',
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      deactivatedMembers: activeMembers.length,
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/units/:id ────────────────────────────────────────────────
router.get('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const unit = await prisma.unit.findFirst({
      where: { id: req.params.id, societyId, deletedAt: null },
      include: {
        building: { select: { id: true, name: true } },
        memberships: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        tickets: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: { select: { memberships: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
    });
    if (!unit) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found');

    sendSuccess(res, {
      id: unit.id,
      unitNumber: unit.unitNumber,
      floor: unit.floor,
      type: unit.type,
      bedroomType: unit.bedroomType,
      buildingId: unit.buildingId,
      buildingName: unit.building.name,
      primaryContactName: unit.primaryContactName,
      primaryContactEmail: unit.primaryContactEmail,
      primaryContactPhone: unit.primaryContactPhone,
      hasLinkedResident: unit._count.memberships > 0,
      members: unit.memberships.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      recentTickets: unit.tickets,
      createdAt: unit.createdAt.toISOString(),
      updatedAt: unit.updatedAt.toISOString(),
    });
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
