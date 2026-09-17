import type { Role, UploadPurpose } from '@apartment/shared';
import { UPLOAD_PURPOSE_CONFIG, storageFolder } from '@apartment/shared';
import { prisma } from './prisma';
import { AppError, ErrorCodes } from './app-error';
import { can } from './permissions';
import type { AuthAction, AuthResource } from './permissions';
import { getUserUnitIds } from './user-units';

/**
 * What each upload purpose is allowed to do (ADR 002).
 *
 * `POST /api/v1/uploads/signature` is not a generic "any authenticated user may
 * upload" endpoint: the purpose decides which existing permission check applies
 * *and* which record the upload may hang off. That second part matters as much as
 * RBAC - without it, a resident could ask for a signature against another
 * resident's ticket (or another society's), and Cloudinary would happily accept
 * the file into that folder.
 */

export interface UploadContext {
  societyId: string;
  userId: string;
  role: Role;
}

export interface ResolvedUpload {
  purpose: UploadPurpose;
  resourceType: string;
  resourceId: string;
  folder: string;
  allowedFormats: readonly string[];
  maxFileSizeBytes: number;
}

export interface UploadTarget {
  resourceType: string;
  resourceId: string;
}

interface PurposeDefinition {
  /**
   * The permission matrix has no `attach`/`submit` actions, so each purpose maps
   * onto the closest existing one - the same thing the routes already do for
   * review approvals (`update`) and SOS acknowledgement (`update`).
   */
  permission: { action: AuthAction; resource: AuthResource };
  /** 404/403 when the target record is not reachable by this caller. */
  authorizeTarget(target: UploadTarget, ctx: UploadContext): Promise<void>;
}

function isAdmin(role: Role): boolean {
  return role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
}

const PURPOSE_DEFINITIONS: Record<UploadPurpose, PurposeDefinition> = {
  /**
   * Ticket photos. Residents attach to their own ticket, admins to any ticket in
   * their society - exactly the rule `POST /tickets/:id/photos` already applied.
   */
  'ticket-photo': {
    permission: { action: 'read', resource: 'ticket' },
    async authorizeTarget(target, ctx) {
      const ticket = await prisma.ticket.findFirst({
        where: { id: target.resourceId, societyId: ctx.societyId, deletedAt: null },
        select: { id: true, residentId: true },
      });
      if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Ticket not found');
      if (!isAdmin(ctx.role) && ticket.residentId !== ctx.userId) {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
      }
    },
  },

  /**
   * Payment proof screenshots. Same ownership scoping as the proof submission
   * itself: admins may attach to any invoice, a resident only to an invoice for a
   * unit they belong to.
   */
  'payment-proof': {
    permission: { action: 'create', resource: 'payment_proof' },
    async authorizeTarget(target, ctx) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: target.resourceId, societyId: ctx.societyId, deletedAt: null },
        select: { id: true, unitId: true },
      });
      if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invoice not found');
      if (!isAdmin(ctx.role)) {
        const unitIds = await getUserUnitIds(ctx.userId, ctx.societyId);
        if (!unitIds.includes(invoice.unitId)) {
          throw new AppError(ErrorCodes.FORBIDDEN, 403, 'You can only upload for your own invoices');
        }
      }
    },
  },
};

/**
 * Authorize an upload and work out where the asset may live. The folder is built
 * from the session's `societyId` - a client-supplied society is never accepted.
 */
export async function resolveUploadTarget(
  purpose: UploadPurpose,
  resourceId: string,
  ctx: UploadContext
): Promise<ResolvedUpload> {
  const definition = PURPOSE_DEFINITIONS[purpose];
  const config = UPLOAD_PURPOSE_CONFIG[purpose];
  if (!definition || !config) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Unknown upload purpose');
  }

  if (!can(ctx.role, definition.permission.action, definition.permission.resource)) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      403,
      `Role '${ctx.role}' is not allowed to upload a ${config.label}`
    );
  }

  const target: UploadTarget = { resourceType: config.resourceType, resourceId };
  await definition.authorizeTarget(target, ctx);

  return {
    purpose,
    resourceType: config.resourceType,
    resourceId,
    folder: storageFolder(ctx.societyId, config.resourceType, resourceId),
    allowedFormats: config.allowedFormats,
    maxFileSizeBytes: config.maxFileSizeBytes,
  };
}

/** Config for one purpose (limits/formats), without any authorization. */
export function uploadPurposeConfig(purpose: UploadPurpose) {
  return UPLOAD_PURPOSE_CONFIG[purpose];
}
