import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

const MONTHS = 6; // how far back the dues collection chart reaches

function monthBounds(offset: number, now: Date): { start: Date; end: Date; key: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  return { start, end, key };
}

// ── GET /api/v1/analytics ──────────────────────────────────────────────────
// Admin-only aggregate view: dues collection rate over time, ticket resolution
// time, ticket volume by category, and vendor performance (ratings + volume).
// Pure read/aggregate queries over existing data — no new entities.
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'analytics'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const now = new Date();

      // ── 1. Dues collection rate over the last N months ─────────────────
      const buckets = Array.from({ length: MONTHS }, (_, i) => monthBounds(MONTHS - 1 - i, now));
      const monthQueries = buckets.map((b) =>
        Promise.all([
          prisma.invoice.aggregate({
            where: {
              societyId,
              deletedAt: null,
              status: { not: 'CANCELLED' },
              dueDate: { gte: b.start, lt: b.end },
            },
            _sum: { amount: true },
          }),
          prisma.payment.aggregate({
            where: {
              societyId,
              status: 'succeeded',
              paidAt: { gte: b.start, lt: b.end },
            },
            _sum: { amount: true },
          }),
        ]).then(([invoiced, collected]) => {
          const inv = invoiced._sum.amount ?? 0;
          const col = collected._sum.amount ?? 0;
          return {
            month: b.key,
            invoiced: inv,
            collected: col,
            // Percentage, rounded to whole number; null when nothing was invoiced.
            rate: inv > 0 ? Math.round((col / inv) * 100) : null,
          };
        })
      );
      const duesCollection = await Promise.all(monthQueries);

      // ── 2. Average ticket resolution time (closed tickets) ─────────────
      const closedTickets = await prisma.ticket.findMany({
        where: { societyId, deletedAt: null, status: 'CLOSED' },
        select: { createdAt: true, closedAt: true, updatedAt: true },
      });
      const durationsMs = closedTickets.map((t) =>
        (t.closedAt ?? t.updatedAt).getTime() - t.createdAt.getTime()
      );
      const avgHours =
        durationsMs.length > 0
          ? Math.round((durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 3600000) * 10) / 10
          : null;
      const ticketResolution = {
        closedCount: durationsMs.length,
        avgHours,
        avgDays: avgHours !== null ? Math.round((avgHours / 24) * 10) / 10 : null,
      };

      // ── 3. Ticket volume by category ────────────────────────────────────
      const byCategory = await prisma.ticket.groupBy({
        by: ['category'],
        where: { societyId, deletedAt: null },
        _count: { _all: true },
      });
      const ticketVolumeByCategory = byCategory
        .map((g) => ({ category: g.category, count: g._count._all }))
        .sort((a, b) => b.count - a.count);

      // ── 4. Vendor performance (ratings from slice 3 + closed volume) ───
      const [ratings, closedByVendor] = await Promise.all([
        prisma.ticket.groupBy({
          by: ['assignedTo'],
          where: { societyId, deletedAt: null, assignedTo: { not: null }, rating: { not: null } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        prisma.ticket.groupBy({
          by: ['assignedTo'],
          where: { societyId, deletedAt: null, assignedTo: { not: null }, status: 'CLOSED' },
          _count: { _all: true },
        }),
      ]);

      const closedMap = new Map(closedByVendor.map((g) => [g.assignedTo, g._count._all]));
      const vendorPerformance = ratings
        .filter((g): g is typeof g & { assignedTo: string } => !!g.assignedTo)
        .map((g) => ({
          vendorName: g.assignedTo,
          avgRating: Math.round((g._avg.rating ?? 0) * 10) / 10,
          ratingCount: g._count.rating,
          closedTickets: closedMap.get(g.assignedTo) ?? 0,
        }))
        .sort((a, b) => b.avgRating - a.avgRating || b.closedTickets - a.closedTickets);

      sendSuccess(res, {
        duesCollection,
        ticketResolution,
        ticketVolumeByCategory,
        vendorPerformance,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
