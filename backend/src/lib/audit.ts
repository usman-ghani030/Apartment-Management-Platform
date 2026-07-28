import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

interface AuditLogEntry {
  societyId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Write an audit log entry. Called by every mutating API route.
 * before/after are optional JSON snapshots for change tracking.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      societyId: entry.societyId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeJson: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterJson: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
