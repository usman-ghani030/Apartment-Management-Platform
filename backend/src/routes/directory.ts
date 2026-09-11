import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';

const router = Router();

export interface DirectoryEntry {
  userId: string;
  name: string;
  email: string;
  unitId: string | null;
  unitNumber: string | null;
  floor: number | null;
  buildingId: string | null;
  buildingName: string | null;
  role: string;
}

// ── GET /api/v1/directory ──────────────────────────────────────────────────
// List all active residents with their building/unit info for the current society.
// Admins see all residents; residents see the directory too (by permission).
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'membership'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const search = (req.query.q as string || '').trim();

      const where: any = {
        societyId,
        status: 'ACTIVE',
        deletedAt: null,
      };

      // Apply search at the database level
      if (search) {
        where.OR = [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
          { unit: { building: { name: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const memberships = await prisma.membership.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              floor: true,
              buildingId: true,
              building: { select: { name: true } },
            },
          },
        },
        orderBy: [
          { unit: { building: { name: 'asc' } } },
          { unit: { floor: 'asc' } },
          { unit: { unitNumber: 'asc' } },
        ],
      });

      const entries: DirectoryEntry[] = memberships.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        unitId: m.unit?.id ?? null,
        unitNumber: m.unit?.unitNumber ?? null,
        floor: m.unit?.floor ?? null,
        buildingId: m.unit?.buildingId ?? null,
        buildingName: m.unit?.building?.name ?? null,
        role: m.role,
      }));

      sendSuccess(res, entries);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/directory/:userId ────────────────────────────────────────
// Get a single resident's full detail including unit info, tickets, and invoices.
router.get(
  '/:userId',
  requireAuth,
  loadMembership,
  requireRole('read', 'membership'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const { userId } = req.params;

      // Find the active membership for this user in this society
      const membership = await prisma.membership.findFirst({
        where: {
          userId,
          societyId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              floor: true,
              buildingId: true,
              bedroomType: true,
              primaryContactName: true,
              primaryContactEmail: true,
              primaryContactPhone: true,
              building: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!membership) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Resident not found in this society');
      }

      // Get recent tickets for this user
      const recentTickets = await prisma.ticket.findMany({
        where: {
          residentId: userId,
          societyId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      // Get recent invoices for this user's unit
      const recentInvoices = membership.unitId
        ? await prisma.invoice.findMany({
            where: {
              unitId: membership.unitId,
              societyId,
              deletedAt: null,
            },
            select: {
              id: true,
              invoiceNumber: true,
              title: true,
              amount: true,
              status: true,
              dueDate: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [];

      // Get ticket counts by status
      const ticketStats = await prisma.ticket.groupBy({
        by: ['status'],
        where: {
          residentId: userId,
          societyId,
          deletedAt: null,
        },
        _count: true,
      });

      sendSuccess(res, {
        userId: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        joinedAt: membership.user.createdAt.toISOString(),
        role: membership.role,
        membershipId: membership.id,
        unit: membership.unit
          ? {
              id: membership.unit.id,
              unitNumber: membership.unit.unitNumber,
              floor: membership.unit.floor,
              bedroomType: membership.unit.bedroomType,
              buildingId: membership.unit.buildingId,
              buildingName: membership.unit.building.name,
            }
          : null,
        recentTickets,
        recentInvoices,
        ticketStats: ticketStats.map((s) => ({ status: s.status, count: s._count })),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
