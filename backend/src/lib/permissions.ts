import type { Role } from '@apartment/shared';

/**
 * Resource types for permission checks.
 * Extend this as new domains are added in later phases.
 */
export type AuthResource =
  | 'society'
  | 'building'
  | 'unit'
  | 'membership'
  | 'user'
  | 'notice'
  | 'ticket'
  | 'invoice'
  | 'amenity'
  | 'booking'
  | 'visitor'
  | 'gate_log'
  | 'poll'
  | 'document'
  | 'parcel'
  | 'vendor'
  | 'analytics'
  | 'audit_log';

/**
 * Actions that can be performed on resources.
 */
export type AuthAction = 'create' | 'read' | 'update' | 'delete' | 'invite' | 'manage';

/**
 * Role hierarchy: higher roles inherit all permissions from lower roles.
 * Ordered from most privileged to least.
 */
const ROLE_HIERARCHY: Role[] = ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT', 'SECURITY_GUARD', 'VENDOR'];

function roleIndex(role: Role): number {
  const idx = ROLE_HIERARCHY.indexOf(role);
  return idx === -1 ? Infinity : idx;
}

/**
 * Permission matrix.
 * Defines which roles can perform which actions on which resources.
 * COMMITTEE_ADMIN can do everything SUPER_ADMIN can within their society.
 * RESIDENT has limited read/write on their own data.
 */
const PERMISSION_MATRIX: Record<AuthResource, Partial<Record<AuthAction, Role[]>>> = {
  society: {
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    manage: ['SUPER_ADMIN'],
  },
  building: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  unit: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  membership: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    invite: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  user: {
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
  },
  notice: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  ticket: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  invoice: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  amenity: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  booking: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  visitor: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT', 'SECURITY_GUARD'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  gate_log: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'SECURITY_GUARD'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'SECURITY_GUARD'],
  },
  poll: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  document: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  parcel: {
    create: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'SECURITY_GUARD'],
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT', 'SECURITY_GUARD'],
    update: ['SUPER_ADMIN', 'COMMITTEE_ADMIN', 'RESIDENT'],
    delete: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  audit_log: {
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  // Phase 7: vendor ratings — admins read/aggregate, residents/guards don't
  vendor: {
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
  // Phase 7: analytics dashboard — admins only
  analytics: {
    read: ['SUPER_ADMIN', 'COMMITTEE_ADMIN'],
  },
};

/**
 * Check if a user with the given role can perform `action` on `resource`.
 *
 * Respects the role hierarchy: a more privileged role can do everything
 * a less privileged role can do.
 */
export function can(role: Role, action: AuthAction, resource: AuthResource): boolean {
  const allowedRoles = PERMISSION_MATRIX[resource]?.[action];
  if (!allowedRoles) return false;

  const userLevel = roleIndex(role);
  return allowedRoles.some((allowed) => roleIndex(allowed) >= userLevel);
}
