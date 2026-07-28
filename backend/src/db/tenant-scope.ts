import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Tenant-scoped wrapper around Prisma operations.
 * Every query automatically filters by societyId to prevent
 * cross-tenant data leaks (non-negotiable — PLAN.md §4.1).
 *
 * Soft-delete entities: all read operations exclude deleted records
 * (`deletedAt: null`) by default.
 */

interface TenantContext {
  societyId: string;
}

// ── Society ─────────────────────────────────────────────────────────────────
export function tenantSociety(ctx: TenantContext) {
  return {
    findMany: (args?: Omit<Prisma.SocietyFindManyArgs, 'where'>) =>
      prisma.society.findMany({ ...args, where: { id: ctx.societyId } }),

    findUnique: () =>
      prisma.society.findUnique({ where: { id: ctx.societyId } }),

    update: (data: Prisma.SocietyUpdateInput) =>
      prisma.society.update({ where: { id: ctx.societyId }, data }),
  };
}

// ── Building ────────────────────────────────────────────────────────────────
export function tenantBuilding(ctx: TenantContext) {
  return {
    findMany: (args?: Omit<Prisma.BuildingFindManyArgs, 'where'>) =>
      prisma.building.findMany({
        ...args,
        where: { societyId: ctx.societyId },
      }),

    findById: (id: string) =>
      prisma.building.findFirst({
        where: { id, societyId: ctx.societyId },
      }),

    create: (data: Prisma.BuildingUncheckedCreateInput) =>
      prisma.building.create({
        data: { ...data, societyId: ctx.societyId },
      }),

    update: (id: string, data: Prisma.BuildingUpdateInput) =>
      prisma.building.updateMany({
        where: { id, societyId: ctx.societyId },
        data,
      }),
  };
}

// ── Unit ────────────────────────────────────────────────────────────────────
export function tenantUnit(ctx: TenantContext) {
  return {
    findMany: (args?: Omit<Prisma.UnitFindManyArgs, 'where'>) =>
      prisma.unit.findMany({
        ...args,
        where: { societyId: ctx.societyId, deletedAt: null },
      }),

    findById: (id: string) =>
      prisma.unit.findFirst({
        where: { id, societyId: ctx.societyId, deletedAt: null },
      }),

    create: (data: Prisma.UnitUncheckedCreateInput) =>
      prisma.unit.create({
        data: { ...data, societyId: ctx.societyId },
      }),

    update: (id: string, data: Prisma.UnitUpdateInput) =>
      prisma.unit.updateMany({
        where: { id, societyId: ctx.societyId },
        data,
      }),

    softDelete: (id: string) =>
      prisma.unit.updateMany({
        where: { id, societyId: ctx.societyId },
        data: { deletedAt: new Date() },
      }),
  };
}

// ── Membership ──────────────────────────────────────────────────────────────
export function tenantMembership(ctx: TenantContext) {
  return {
    findMany: (args?: Omit<Prisma.MembershipFindManyArgs, 'where'>) =>
      prisma.membership.findMany({
        ...args,
        where: { societyId: ctx.societyId, deletedAt: null },
      }),

    findById: (id: string) =>
      prisma.membership.findFirst({
        where: { id, societyId: ctx.societyId, deletedAt: null },
      }),

    findByUser: (userId: string) =>
      prisma.membership.findFirst({
        where: { userId, societyId: ctx.societyId, deletedAt: null, status: 'ACTIVE' },
      }),

    create: (data: Prisma.MembershipUncheckedCreateInput) =>
      prisma.membership.create({
        data: { ...data, societyId: ctx.societyId },
      }),

    update: (id: string, data: Prisma.MembershipUpdateInput) =>
      prisma.membership.updateMany({
        where: { id, societyId: ctx.societyId },
        data,
      }),

    softDelete: (id: string) =>
      prisma.membership.updateMany({
        where: { id, societyId: ctx.societyId },
        data: { deletedAt: new Date() },
      }),
  };
}

// ── Audit Log (read-only via tenant scope) ──────────────────────────────────
export function tenantAuditLog(ctx: TenantContext) {
  return {
    findMany: (args?: Omit<Prisma.AuditLogFindManyArgs, 'where'>) =>
      prisma.auditLog.findMany({
        ...args,
        where: { societyId: ctx.societyId },
      }),
  };
}
