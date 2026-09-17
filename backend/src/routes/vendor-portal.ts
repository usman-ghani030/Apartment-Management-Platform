import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { logAudit } from '../lib/audit';
import { sendNotification } from '../lib/notifications';
import { VendorStatusUpdateSchema } from '@apartment/shared';
import type { TicketStatus, VendorTicketView } from '@apartment/shared';
import {
  formatTicketRef,
  getVendorAllowedTransitions,
  hashVendorAccessToken,
  isPlausibleVendorToken,
  isVendorTransitionAllowed,
} from '../lib/vendor-access';
import { vendorTokenIpLimiter, vendorTokenLookupLimiter } from '../lib/rate-limit';

// ─────────────────────────────────────────────────────────────────────────────
// Public vendor magic-link portal
//
// These routes are deliberately unauthenticated (vendors have no accounts): the
// secret token in the emailed link IS the credential. Consequences that are
// enforced here on every single request:
//
//   * The token lookup is by SHA-256 hash stored on the Ticket row, so a valid
//     token can only ever resolve to the one ticket it was issued for - it
//     cannot reach another ticket, another society, or any other feature.
//   * The response is a deliberately limited view: no resident name/email/phone,
//     no financial data, no comments, no other tickets, nothing admin-only.
//   * CLOSED tickets stop resolving, and reassignment overwrites the hash, so
//     revoked links simply 404.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

const INVALID_LINK_MESSAGE =
  'This link is no longer valid. Please ask your contact at the society to send you a new one.';
const CLOSED_MESSAGE =
  'This ticket has been closed by the society. No further updates are needed.';

type VendorTicketRecord = Prisma.TicketGetPayload<{
  include: {
    society: { select: { name: true } };
    unit: { select: { unitNumber: true } };
  };
}>;

const VENDOR_TICKET_INCLUDES = {
  society: { select: { name: true } },
  unit: { select: { unitNumber: true } },
} as const;

/** Only the fields a vendor needs to do the job - nothing else is exposed. */
function formatVendorView(t: VendorTicketRecord): VendorTicketView {
  let photos: string[] = [];
  if (t.photosUrl) {
    try {
      const parsed = JSON.parse(t.photosUrl);
      if (Array.isArray(parsed)) {
        photos = parsed.filter((p): p is string => typeof p === 'string');
      }
    } catch {
      photos = [];
    }
  }

  const status = t.status as TicketStatus;
  return {
    ticketRef: formatTicketRef(t.id),
    societyName: t.society.name,
    vendorName: t.assignedTo ?? '',
    title: t.title,
    description: t.description,
    category: t.category,
    status,
    unitNumber: t.unit?.unitNumber ?? null,
    // Relative paths - the client prefixes them with the API base URL.
    photos,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    allowedTransitions: getVendorAllowedTransitions(status),
  };
}

/** Apply both public rate limits (per IP and per token). */
function enforceVendorRateLimits(req: { ip?: string; socket: { remoteAddress?: string } }, rawToken: string): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ipCheck = vendorTokenIpLimiter.check(ip);
  if (!ipCheck.allowed) {
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      429,
      `Too many requests. Please try again in ${ipCheck.retryAfterSeconds} seconds.`
    );
  }

  // Keyed by the token's hash so the raw token is never held in memory.
  const tokenCheck = vendorTokenLookupLimiter.check(hashVendorAccessToken(rawToken));
  if (!tokenCheck.allowed) {
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      429,
      `Too many requests for this link. Please try again in ${tokenCheck.retryAfterSeconds} seconds.`
    );
  }
}

/**
 * Resolve the single ticket a token grants access to.
 *
 * The token hash is a unique column on the Ticket row, so "which ticket" is
 * unambiguous by construction; the explicit checks below make the society +
 * ticket + vendor scoping fail closed rather than relying on that alone.
 */
async function resolveVendorTicket(rawToken: string): Promise<VendorTicketRecord> {
  // Reject junk before it costs a database round-trip.
  if (!isPlausibleVendorToken(rawToken)) {
    throw new AppError(ErrorCodes.NOT_FOUND, 404, INVALID_LINK_MESSAGE);
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      vendorAccessTokenHash: hashVendorAccessToken(rawToken),
      vendorAccessTokenIssuedAt: { not: null },
      deletedAt: null,
    },
    include: VENDOR_TICKET_INCLUDES,
  });

  // Unknown / rotated / revoked token, or a ticket that is no longer assigned.
  if (!ticket || !ticket.assignedTo) {
    throw new AppError(ErrorCodes.NOT_FOUND, 404, INVALID_LINK_MESSAGE);
  }

  // Closing a ticket ends vendor access, even via an otherwise-valid link. This
  // status check (not deletion of the token) is the authoritative gate on
  // closure, so the vendor gets a message that actually explains what happened.
  if (ticket.status === 'CLOSED') {
    throw new AppError(ErrorCodes.NOT_FOUND, 404, CLOSED_MESSAGE);
  }

  return ticket;
}

// ── GET /api/v1/vendor/ticket/:token ────────────────────────────────────────
// The limited view of the one ticket this token grants access to.
router.get('/ticket/:token', async (req, res, next) => {
  try {
    enforceVendorRateLimits(req, req.params.token);
    const ticket = await resolveVendorTicket(req.params.token);
    sendSuccess(res, formatVendorView(ticket));
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/vendor/ticket/:token/status ───────────────────────────────
// The vendor's only write action: move the ticket through their allowed
// transitions (ASSIGNED → IN_PROGRESS → RESOLVED). CLOSED is admin-only, since
// it also captures the Phase 7 vendor rating.
router.patch('/ticket/:token/status', async (req, res, next) => {
  try {
    enforceVendorRateLimits(req, req.params.token);
    const input = VendorStatusUpdateSchema.parse(req.body);
    const ticket = await resolveVendorTicket(req.params.token);
    const from = ticket.status as TicketStatus;

    if (!isVendorTransitionAllowed(from, input.status)) {
      const allowed = getVendorAllowedTransitions(from);
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        400,
        `This ticket cannot be moved from ${from} to ${input.status}.` +
          (allowed.length ? ` Allowed: ${allowed.join(', ')}.` : ' No further vendor updates are possible.')
      );
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: input.status },
      include: VENDOR_TICKET_INCLUDES,
    });

    // Attributed to the vendor, not a user: there is no User account behind this
    // action, and actorUserId stays null so `after.vendor` is what identifies the
    // actor in the audit trail / ticket history.
    await logAudit({
      societyId: ticket.societyId,
      actorUserId: null,
      action: 'TICKET_STATUS_UPDATED_BY_VENDOR',
      entityType: 'ticket',
      entityId: ticket.id,
      before: { status: from },
      after: {
        status: updated.status,
        vendor: ticket.assignedTo,
        via: 'vendor_magic_link',
      },
    });

    await sendNotification({
      type: 'TICKET_STATUS_CHANGED',
      ticketId: updated.id,
      title: updated.title,
      societyId: ticket.societyId,
      oldStatus: from,
      newStatus: updated.status,
    });

    sendSuccess(res, formatVendorView(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
