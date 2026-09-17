import { createHash, randomBytes } from 'crypto';
import type { TicketStatus, VendorStatusUpdate } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Vendor magic-link access
//
// Vendors do not have accounts (PLAN.md §13), so an assigned vendor is given a
// token-secured public link instead. Deliberate differences from the password
// reset token (see lib/password-reset.ts), because the requirements differ:
//
//   * NOT single-use - the vendor returns to the same link over several days
//     ("In Progress" today, "Resolved" later).
//   * NOT time-limited - validity is governed by ticket state instead: while the
//     ticket is still assigned to that vendor and not CLOSED.
//   * Invalidated by *rotation*: reassigning the ticket overwrites the stored
//     hash, so the previous vendor's link stops working immediately.
//
// Like the reset token, only the SHA-256 hash is persisted; the raw token exists
// solely inside the emailed URL.
// ─────────────────────────────────────────────────────────────────────────────

/** 256 bits of CSPRNG entropy, base64url-encoded (43 chars) - not guessable. */
export function generateVendorAccessToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashVendorAccessToken(raw) };
}

export function hashVendorAccessToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Reject obviously-malformed tokens before they reach the database, so a
 * brute-force scan can't even cost us a query per junk guess.
 */
export function isPlausibleVendorToken(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(raw);
}

/** Base URL of the frontend app (where the public vendor page lives). */
export function getVendorPortalBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Base URL of the backend API. Ticket photos are served from here, and email
 * clients need absolute URLs, so this must be the publicly reachable backend
 * origin in production (Render).
 */
export function getPublicApiBaseUrl(): string {
  return (process.env.API_PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

export function buildVendorTicketUrl(rawToken: string): string {
  return `${getVendorPortalBaseUrl()}/vendor/ticket/${encodeURIComponent(rawToken)}`;
}

/**
 * The only status transitions a vendor may perform. `CLOSED` is intentionally
 * absent - closing is an admin action that also captures the vendor rating
 * (Phase 7), so RESOLVED is the end of the vendor's flow.
 */
const VENDOR_TRANSITIONS: Record<TicketStatus, VendorStatusUpdate[]> = {
  OPEN: [],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
  CLOSED: [],
};

export function getVendorAllowedTransitions(status: TicketStatus): VendorStatusUpdate[] {
  return VENDOR_TRANSITIONS[status] ?? [];
}

export function isVendorTransitionAllowed(from: TicketStatus, to: VendorStatusUpdate): boolean {
  return getVendorAllowedTransitions(from).includes(to);
}

export function getVendorStatusLabel(status: TicketStatus): string {
  return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short, human-friendly ticket reference shown to the vendor (not the UUID). */
export function formatTicketRef(ticketId: string): string {
  return `#${ticketId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

// ── Email template ──────────────────────────────────────────────────────────

export interface VendorAssignmentEmailData {
  vendorName: string;
  societyName: string;
  ticketRef: string;
  title: string;
  description: string;
  category: string;
  unitNumber: string | null;
  /** Absolute URLs - email clients cannot resolve relative paths. */
  photoUrls: string[];
  /** The magic link. */
  ticketUrl: string;
}

export function buildVendorAssignmentEmail(
  data: VendorAssignmentEmailData
): { subject: string; html: string; text: string } {
  const subject = `New job assigned: ${data.ticketRef} - ${data.title}`;
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const details = [
    ['Reference', data.ticketRef],
    ['Society', data.societyName],
    ['Unit', data.unitNumber || 'Not specified'],
    ['Category', data.category],
    ['Issue', data.title],
  ];

  const photosHtml = data.photoUrls.length
    ? `
      <p style="color:#4b5563;font-size:14px;margin:20px 0 8px;"><strong>Attached photos</strong></p>
      <p style="margin:0 0 8px;">
        ${data.photoUrls
          .map(
            (url, i) =>
              `<a href="${escapeHtml(url)}" style="color:#4f46e5;font-size:13px;">Photo ${i + 1}</a>`
          )
          .join(' &middot; ')}
      </p>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#1f2937;margin:0 0 4px;">New maintenance job assigned to you</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">Hello ${escapeHtml(data.vendorName)}, you have been assigned the ticket below.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;color:#374151;">
        ${details
          .map(
            ([label, value]) =>
              `<tr><td style="padding:6px 0;color:#6b7280;width:110px;">${escapeHtml(label)}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`
          )
          .join('')}
      </table>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:16px 0;color:#374151;font-size:14px;white-space:pre-wrap;">${escapeHtml(data.description)}</div>
      ${photosHtml}
      <p style="text-align:center;margin:28px 0;">
        <a href="${data.ticketUrl}" style="background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          View job &amp; update status
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;">
        This link is personal to you and works without a login. Use it to mark the
        job <strong>In Progress</strong> and later <strong>Resolved</strong>. Please don't
        forward it - anyone with the link can update this ticket.
      </p>
    </div>
  `;

  const text = [
    `New maintenance job assigned to you`,
    ``,
    `Hello ${data.vendorName}, you have been assigned the ticket below.`,
    ``,
    `Reference: ${data.ticketRef}`,
    `Society:   ${data.societyName}`,
    `Unit:      ${data.unitNumber || 'Not specified'}`,
    `Category:  ${data.category}`,
    `Issue:     ${data.title}`,
    ``,
    data.description,
    ...(data.photoUrls.length ? ['', 'Photos:', ...data.photoUrls] : []),
    ``,
    `View the job and update its status:`,
    data.ticketUrl,
    ``,
    `This link is personal to you and works without a login. Use it to mark the job`,
    `In Progress and later Resolved. Please don't forward it.`,
  ].join('\n');

  return { subject, html, text };
}
