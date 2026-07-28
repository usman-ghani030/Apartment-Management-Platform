import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import type { AuditLogResponse } from '@apartment/shared';

const router = Router();

// ── GET /api/v1/audit-logs — list audit logs with search/filter ───────────
router.get('/', requireAuth, loadMembership, requireRole('read', 'audit_log'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const action = req.query.action as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const actorUserId = req.query.actorUserId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
    const skip = (page - 1) * limit;

    const where: any = { societyId };

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (actorUserId) {
      where.actorUserId = actorUserId;
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Fetch actor names in batch
    const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))] as string[];
    const actors = actorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a.name]));

    const formattedLogs: AuditLogResponse[] = logs.map((l) => ({
      id: l.id, societyId: l.societyId,
      actorUserId: l.actorUserId, actorName: l.actorUserId ? actorMap.get(l.actorUserId) || 'Unknown' : 'System',
      action: l.action, entityType: l.entityType, entityId: l.entityId,
      beforeJson: l.beforeJson as Record<string, unknown> | null,
      afterJson: l.afterJson as Record<string, unknown> | null,
      createdAt: l.createdAt.toISOString(),
    }));

    sendSuccess(res, {
      logs: formattedLogs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/audit-logs/entity/:entityType/:entityId — get logs for specific entity
router.get('/entity/:entityType/:entityId', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const logs = await prisma.auditLog.findMany({
      where: { societyId, entityType: req.params.entityType, entityId: req.params.entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))] as string[];
    const actors = actorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a.name]));

    sendSuccess(res, logs.map((l) => ({
      id: l.id, societyId: l.societyId,
      actorUserId: l.actorUserId, actorName: l.actorUserId ? actorMap.get(l.actorUserId) || 'Unknown' : 'System',
      action: l.action, entityType: l.entityType, entityId: l.entityId,
      beforeJson: l.beforeJson as Record<string, unknown> | null,
      afterJson: l.afterJson as Record<string, unknown> | null,
      createdAt: l.createdAt.toISOString(),
    } as AuditLogResponse)));
  } catch (err) { next(err); }
});

// ── GET /api/v1/audit-logs/export — export audit logs as JSON for committee transition
router.get('/export', requireAuth, loadMembership, requireRole('read', 'audit_log'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const entityType = req.query.entityType as string | undefined;

    const where: any = { societyId };
    if (entityType) where.entityType = entityType;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))] as string[];
    const actors = actorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const society = await prisma.society.findUnique({ where: { id: societyId } });

    const exportData = {
      exportedAt: new Date().toISOString(),
      society: { id: society?.id, name: society?.name, slug: society?.slug },
      totalLogs: logs.length,
      logs: logs.map((l) => ({
        id: l.id, action: l.action, entityType: l.entityType, entityId: l.entityId,
        actor: l.actorUserId ? actorMap.get(l.actorUserId) || null : null,
        before: l.beforeJson, after: l.afterJson,
        createdAt: l.createdAt.toISOString(),
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${society?.slug || societyId}-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (err) { next(err); }
});

export default router;
