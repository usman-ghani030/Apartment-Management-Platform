import { prisma } from './prisma';

/**
 * The unit ids a user belongs to in one society, via active memberships.
 *
 * This is the ownership scoping invoice/parcel access already uses. It lived as
 * a private copy in `routes/invoices.ts` and `routes/parcels.ts`; it is one
 * helper now so a new call site (signed uploads, ADR 002) cannot drift on what
 * "belongs to this user" means.
 */
export async function getUserUnitIds(userId: string, societyId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, societyId, status: 'ACTIVE', deletedAt: null, unitId: { not: null } },
    select: { unitId: true },
  });
  return memberships.map((m) => m.unitId).filter(Boolean) as string[];
}
