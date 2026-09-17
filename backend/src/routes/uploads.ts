import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { SignUploadSchema, ConfirmUploadSchema, DeleteUploadSchema, storageFolder } from '@apartment/shared';
import type { ConfirmedUploadResponse, UploadSignatureResponse } from '@apartment/shared';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { getStorageProvider } from '../lib/storage';
import { resolveUploadTarget, uploadPurposeConfig } from '../lib/upload-purposes';
import type { Role } from '@apartment/shared';

/**
 * Signed uploads (ADR 002).
 *
 * The browser talks to Cloudinary directly using params signed here, so files
 * never flow through Express and the API secret never reaches the client. These
 * routes deliberately know nothing about tickets or payment proofs: they hand
 * back a validated asset and let the calling feature persist it against its own
 * record (`Ticket.photosUrl`, `PaymentProof.screenshotUrl`).
 */

const router = Router();

/**
 * These routes authorize by purpose rather than with `requireRole`, so they need
 * their own membership guard: `loadMembership` silently leaves `req.membership`
 * unset when there is no active membership for the requested society (e.g. a
 * forged `x-society-id`), which would otherwise read as a 500.
 */
function requireMembership(req: Request, _res: Response, next: NextFunction): void {
  if (!req.membership) {
    next(new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required for this action'));
    return;
  }
  next();
}

// ── POST /api/v1/uploads/signature ─────────────────────────────────────────
// Auth + a purpose-specific permission check: `purpose` selects both the rights
// required and the record the asset may be attached to.
router.post('/signature', requireAuth, loadMembership, requireMembership, async (req, res, next) => {
  try {
    const input = SignUploadSchema.parse(req.body);
    const ctx = {
      societyId: req.membership!.societyId,
      userId: req.user!.id,
      role: req.membership!.role as Role,
    };

    const target = await resolveUploadTarget(input.purpose, input.resourceId, ctx);
    const provider = getStorageProvider();

    const signed = provider.getSignedUploadParams({
      folder: target.folder,
      allowedFormats: target.allowedFormats,
      maxFileSizeBytes: target.maxFileSizeBytes,
    });

    const payload: UploadSignatureResponse = { ...signed };
    sendSuccess(res, payload);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/uploads/confirm ───────────────────────────────────────────
// Called once the browser's direct upload succeeded. Proves the asset exists,
// lives under the folder this session was signed for, and respects the format and
// size limits - then returns it for the calling feature to persist.
router.post('/confirm', requireAuth, loadMembership, requireMembership, async (req, res, next) => {
  try {
    const input = ConfirmUploadSchema.parse(req.body);
    const ctx = {
      societyId: req.membership!.societyId,
      userId: req.user!.id,
      role: req.membership!.role as Role,
    };

    // Re-authorize: the caller must still be entitled to this target, and the
    // expected folder is recomputed from the session rather than trusted.
    const target = await resolveUploadTarget(input.purpose, input.resourceId, ctx);
    const provider = getStorageProvider();

    const asset = await provider.confirmUpload({
      publicId: input.publicId,
      expectedFolder: target.folder,
      allowedFormats: target.allowedFormats,
      maxFileSizeBytes: target.maxFileSizeBytes,
    });

    await logAudit({
      societyId: ctx.societyId,
      actorUserId: ctx.userId,
      action: 'UPLOAD_CONFIRMED',
      entityType: target.resourceType === 'payment-proofs' ? 'payment_proof' : 'ticket',
      entityId: target.resourceId,
      after: {
        purpose: input.purpose,
        publicId: asset.publicId,
        format: asset.format,
        bytes: asset.bytes,
      },
    });

    const payload: ConfirmedUploadResponse = {
      publicId: asset.publicId,
      url: asset.url,
      format: asset.format,
      bytes: asset.bytes,
      resourceType: target.resourceType,
    };
    sendSuccess(res, payload, 201);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/uploads/asset ───────────────────────────────────────────
// The only path that permanently removes a stored asset. Soft-deleting a domain
// record does NOT call this - a hard cleanup of orphaned assets is a separate
// future task (ADR 002). Admins only, and only inside their own society's folder.
router.delete('/asset', requireAuth, loadMembership, requireMembership, async (req, res, next) => {
  try {
    const input = DeleteUploadSchema.parse(req.body);
    const role = req.membership!.role as Role;
    const societyId = req.membership!.societyId;

    if (role !== 'COMMITTEE_ADMIN' && role !== 'SUPER_ADMIN') {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Only admins can remove stored files');
    }

    const config = uploadPurposeConfig(input.purpose);
    const expectedFolder = storageFolder(societyId, config.resourceType, input.resourceId);
    if (input.publicId.includes('..') || !input.publicId.startsWith(`${expectedFolder}/`)) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        403,
        'That file does not belong to a record in your society'
      );
    }

    await getStorageProvider().delete(input.publicId);

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'UPLOAD_DELETED',
      entityType: config.resourceType === 'payment-proofs' ? 'payment_proof' : 'ticket',
      entityId: input.resourceId,
      after: { purpose: input.purpose, publicId: input.publicId },
    });

    sendSuccess(res, { publicId: input.publicId, deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
