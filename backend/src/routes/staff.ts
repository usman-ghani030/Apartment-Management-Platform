import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess, sendPaginated } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { CreateStaffSchema, UpdateStaffSchema } from '@apartment/shared';
import type { StaffResponse } from '@apartment/shared';

const router = Router();

function formatStaff(staff: any): StaffResponse {
  return {
    id: staff.id,
    societyId: staff.societyId,
    name: staff.name,
    role: staff.role,
    email: staff.email ?? null,
    phone: staff.phone ?? null,
    isActive: staff.isActive,
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  };
}

// ── POST /api/v1/staff ────────────────────────────────────────────────────
// Admin creates a new staff member
router.post(
  '/',
  requireAuth,
  loadMembership,
  requireRole('create', 'staff'),
  async (req, res, next) => {
    try {
      const input = CreateStaffSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const staff = await prisma.staff.create({
        data: {
          societyId,
          name: input.name,
          role: input.role,
          email: input.email ?? null,
          phone: input.phone ?? null,
        },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'STAFF_CREATED',
        entityType: 'staff',
        entityId: staff.id,
        after: { name: staff.name, role: staff.role, email: staff.email, phone: staff.phone },
      });

      sendSuccess(res, formatStaff(staff), 201);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/staff/on-duty ──────────────────────────────────────────────
// Read-only view of active staff - accessible to residents too
router.get(
  '/on-duty',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const staff = await prisma.staff.findMany({
        where: { societyId, isActive: true, deletedAt: null },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });

      sendSuccess(res, staff.map(formatStaff));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/staff ──────────────────────────────────────────────────────
// List all staff for the society (admin view, includes inactive)
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'staff'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = req.query.search as string | undefined;

      const where: any = {
        societyId,
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (cursor) {
        where.createdAt = { lt: new Date(cursor) };
      }

      const staff = await prisma.staff.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        take: limit + 1,
      });

      const hasMore = staff.length > limit;
      const data = staff.slice(0, limit).map(formatStaff);
      const nextCursor = hasMore ? data[data.length - 1].createdAt : null;

      sendPaginated(res, data, nextCursor);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/staff/:id ──────────────────────────────────────────────────
// Get a single staff member
router.get(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('read', 'staff'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const staff = await prisma.staff.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });

      if (!staff) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Staff member not found');
      }

      sendSuccess(res, formatStaff(staff));
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/v1/staff/:id ────────────────────────────────────────────────
// Admin updates a staff member
router.patch(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('update', 'staff'),
  async (req, res, next) => {
    try {
      const input = UpdateStaffSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const existing = await prisma.staff.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });
      if (!existing) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Staff member not found');
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.email !== undefined) updateData.email = input.email || null;
      if (input.phone !== undefined) updateData.phone = input.phone || null;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const staff = await prisma.staff.update({
        where: { id: req.params.id },
        data: updateData,
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'STAFF_UPDATED',
        entityType: 'staff',
        entityId: staff.id,
        before: { name: existing.name, role: existing.role, isActive: existing.isActive },
        after: { name: staff.name, role: staff.role, isActive: staff.isActive },
      });

      sendSuccess(res, formatStaff(staff));
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/v1/staff/:id ───────────────────────────────────────────────
// Admin soft-deletes a staff member
router.delete(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('delete', 'staff'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;

      const existing = await prisma.staff.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });
      if (!existing) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Staff member not found');
      }

      await prisma.staff.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'STAFF_DELETED',
        entityType: 'staff',
        entityId: existing.id,
        before: { name: existing.name, role: existing.role },
      });

      sendSuccess(res, { message: 'Staff member deleted' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
