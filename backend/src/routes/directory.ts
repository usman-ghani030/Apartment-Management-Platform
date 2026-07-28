import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

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

export default router;
