import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// ── Time ranges ────────────────────────────────────────────────────────────
// One month is bucketed by week so a single month still shows a readable
// trend; six months and a year are bucketed by calendar month.
const RangeSchema = z.enum(['1m', '6m', '1y']);
type Range = z.infer<typeof RangeSchema>;
type Granularity = 'week' | 'month';

interface Bucket {
  start: Date;
  end: Date;
  key: string;
  label: string;
}

function buildWindow(range: Range, now: Date): { granularity: Granularity; buckets: Bucket[] } {
  if (range === '1m') {
    // Four 7-day blocks ending now, so the newest block is the week just gone.
    const buckets: Bucket[] = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * DAY_MS);
      const start = new Date(end.getTime() - 7 * DAY_MS);
      buckets.push({
        start,
        end,
        key: start.toISOString().slice(0, 10),
        label: `${MONTH_SHORT[start.getUTCMonth()]} ${start.getUTCDate()}`,
      });
    }
    return { granularity: 'week', buckets };
  }

  const months = range === '6m' ? 6 : 12;
  const buckets = Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1));
    return {
      start,
      end,
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
      // A year crosses a year boundary, so those labels carry the short year.
      label:
        range === '1y'
          ? `${MONTH_SHORT[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(2)}`
          : MONTH_SHORT[start.getUTCMonth()],
    };
  });
  return { granularity: 'month', buckets };
}

/** Invoiced (by due date) and collected (by payment date) per bucket. */
async function collectionSeries(societyId: string, buckets: Bucket[]) {
  return Promise.all(
    buckets.map((b) =>
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
          where: { societyId, status: 'succeeded', paidAt: { gte: b.start, lt: b.end } },
          _sum: { amount: true },
        }),
      ]).then(([invoiced, collected]) => {
        const inv = invoiced._sum.amount ?? 0;
        const col = collected._sum.amount ?? 0;
        return {
          key: b.key,
          label: b.label,
          invoiced: inv,
          collected: col,
          // Percentage, rounded; null when nothing was invoiced in the bucket.
          rate: inv > 0 ? Math.round((col / inv) * 100) : null,
        };
      })
    )
  );
}

// ── GET /api/v1/analytics?range=1m|6m|1y ───────────────────────────────────
// Admin-only aggregate view. Pure read/aggregate queries over existing data,
// no new entities. `range` scopes the whole report; `duesCollection` and
// `ticketResolution` are kept in their original shape because the admin
// dashboard home reads them for its summary tiles.
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'analytics'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const now = new Date();

      const parsedRange = RangeSchema.safeParse(req.query.range ?? '6m');
      if (!parsedRange.success) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Range must be one of 1m, 6m or 1y');
      }
      const range = parsedRange.data;

      const { granularity, buckets } = buildWindow(range, now);
      const windowStart = buckets[0].start;
      const windowEnd = buckets[buckets.length - 1].end;
      const closedInWindow = { gte: windowStart, lt: windowEnd };
      const createdInWindow = { gte: windowStart, lt: windowEnd };

      // ── Trend + window totals ──────────────────────────────────────────
      const [trend, invoicedTotal, collectedTotal, outstanding, overdue, legacySeries] = await Promise.all([
        collectionSeries(societyId, buckets),
        prisma.invoice.aggregate({
          where: { societyId, deletedAt: null, status: { not: 'CANCELLED' }, dueDate: createdInWindow },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { societyId, status: 'succeeded', paidAt: createdInWindow },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        // Money still owed right now, regardless of the selected range.
        prisma.invoice.aggregate({
          where: { societyId, deletedAt: null, status: { in: ['ISSUED', 'OVERDUE', 'DISPUTED'] } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.invoice.aggregate({
          where: { societyId, deletedAt: null, status: 'OVERDUE' },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        // Only needed when the chart is not already a six month series.
        range === '6m'
          ? Promise.resolve(null)
          : collectionSeries(societyId, buildWindow('6m', now).buckets),
      ]);

      const duesInvoiced = invoicedTotal._sum.amount ?? 0;
      const duesCollected = collectedTotal._sum.amount ?? 0;
      const sixMonthSeries = legacySeries ?? trend;

      // ── Tickets ────────────────────────────────────────────────────────
      const [ticketsCreated, ticketsClosed, ticketsByStatus, ticketsByCategory, closedTickets, oldestOpen] =
        await Promise.all([
          prisma.ticket.count({ where: { societyId, deletedAt: null, createdAt: createdInWindow } }),
          prisma.ticket.count({ where: { societyId, deletedAt: null, closedAt: closedInWindow } }),
          prisma.ticket.groupBy({
            by: ['status'],
            where: { societyId, deletedAt: null },
            _count: { _all: true },
          }),
          prisma.ticket.groupBy({
            by: ['category'],
            where: { societyId, deletedAt: null, createdAt: createdInWindow },
            _count: { _all: true },
          }),
          prisma.ticket.findMany({
            where: { societyId, deletedAt: null, closedAt: closedInWindow },
            select: { createdAt: true, closedAt: true, updatedAt: true },
          }),
          prisma.ticket.findFirst({
            where: { societyId, deletedAt: null, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          }),
        ]);

      const durationsMs = closedTickets
        .map((t) => ((t.closedAt ?? t.updatedAt).getTime() - t.createdAt.getTime()))
        .filter((ms) => ms >= 0);
      const avgHours =
        durationsMs.length > 0
          ? Math.round((durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / HOUR_MS) * 10) / 10
          : null;

      const byCategory = ticketsByCategory
        .map((g) => ({ category: g.category, count: g._count._all }))
        .sort((a, b) => b.count - a.count);
      const byStatus = ticketsByStatus
        .map((g) => ({ status: g.status, count: g._count._all }))
        .sort((a, b) => b.count - a.count);
      const openNow = byStatus
        .filter((s) => s.status === 'OPEN' || s.status === 'ASSIGNED' || s.status === 'IN_PROGRESS')
        .reduce((sum, s) => sum + s.count, 0);
      const openOldestDays = oldestOpen
        ? Math.max(0, Math.floor((now.getTime() - oldestOpen.createdAt.getTime()) / DAY_MS))
        : null;

      // ── Vendors ────────────────────────────────────────────────────────
      const [ratings, closedByVendor, assignedCount] = await Promise.all([
        prisma.ticket.groupBy({
          by: ['assignedTo'],
          where: {
            societyId,
            deletedAt: null,
            assignedTo: { not: null },
            rating: { not: null },
            status: 'CLOSED',
            closedAt: closedInWindow,
          },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        prisma.ticket.groupBy({
          by: ['assignedTo'],
          where: { societyId, deletedAt: null, assignedTo: { not: null }, status: 'CLOSED', closedAt: closedInWindow },
          _count: { _all: true },
        }),
        prisma.ticket.count({
          where: { societyId, deletedAt: null, assignedTo: { not: null }, createdAt: createdInWindow },
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

      // ── People, traffic and parcels ────────────────────────────────────
      const [
        newMembers,
        activeResidents,
        activeGuards,
        visitorPasses,
        visitorsOnSite,
        pendingVisitors,
        parcelsLogged,
        parcelsWaiting,
      ] = await Promise.all([
        prisma.membership.count({ where: { societyId, deletedAt: null, status: 'ACTIVE', createdAt: createdInWindow } }),
        prisma.membership.count({ where: { societyId, deletedAt: null, status: 'ACTIVE', role: 'RESIDENT' } }),
        prisma.membership.count({ where: { societyId, deletedAt: null, status: 'ACTIVE', role: 'SECURITY_GUARD' } }),
        prisma.visitorPass.count({ where: { societyId, deletedAt: null, createdAt: createdInWindow } }),
        prisma.visitorPass.count({ where: { societyId, deletedAt: null, status: 'CHECKED_IN' } }),
        prisma.visitorPass.count({ where: { societyId, deletedAt: null, status: 'PENDING' } }),
        prisma.parcel.count({ where: { societyId, deletedAt: null, createdAt: createdInWindow } }),
        prisma.parcel.count({ where: { societyId, deletedAt: null, status: 'ARRIVED' } }),
      ]);

      // ── Occupancy (a snapshot, not a range figure) ─────────────────────
      const unitsByType = await prisma.unit.groupBy({
        by: ['type'],
        where: { societyId, deletedAt: null },
        _count: { _all: true },
      });
      const countOfType = (type: string) =>
        unitsByType.find((g) => g.type === type)?._count._all ?? 0;
      const totalUnits = unitsByType.reduce((sum, g) => sum + g._count._all, 0);
      const vacantUnits = countOfType('VACANT');
      const occupiedUnits = totalUnits - vacantUnits;

      sendSuccess(res, {
        range,
        granularity,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),

        trend,

        dues: {
          invoiced: duesInvoiced,
          collected: duesCollected,
          collectionRate: duesInvoiced > 0 ? Math.round((duesCollected / duesInvoiced) * 100) : null,
          paymentsReceived: collectedTotal._count._all,
          outstanding: outstanding._sum.amount ?? 0,
          outstandingCount: outstanding._count._all,
          overdueAmount: overdue._sum.amount ?? 0,
          overdueCount: overdue._count._all,
        },

        tickets: {
          created: ticketsCreated,
          closed: ticketsClosed,
          openNow,
          byStatus,
          byCategory,
          busiestCategory: byCategory[0] ?? null,
          avgResolutionHours: avgHours,
          avgResolutionDays: avgHours !== null ? Math.round((avgHours / 24) * 10) / 10 : null,
          openOldestDays,
        },

        vendors: {
          performance: vendorPerformance,
          assignedCount,
          ratedCount: vendorPerformance.reduce((sum, v) => sum + v.ratingCount, 0),
          closedCount: vendorPerformance.reduce((sum, v) => sum + v.closedTickets, 0),
        },

        people: {
          newMembers,
          activeResidents,
          activeGuards,
          visitorPasses,
          visitorsOnSite,
          pendingVisitors,
          parcelsLogged,
          parcelsWaiting,
        },

        occupancy: {
          totalUnits,
          occupiedUnits,
          vacantUnits,
          ownerOccupied: countOfType('OWNER_OCCUPIED'),
          rented: countOfType('RENTED'),
          occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : null,
        },

        // ── Original shape, kept for the dashboard home tiles ─────────────
        duesCollection: sixMonthSeries.map((p) => ({
          month: p.key,
          invoiced: p.invoiced,
          collected: p.collected,
          rate: p.rate,
        })),
        ticketResolution: {
          closedCount: durationsMs.length,
          avgHours,
          avgDays: avgHours !== null ? Math.round((avgHours / 24) * 10) / 10 : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
