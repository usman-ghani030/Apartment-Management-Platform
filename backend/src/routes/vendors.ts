import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import {
  CreateVendorSchema,
  UpdateVendorSchema,
  hasVendorContact,
  VENDOR_CONTACT_ERROR,
  phoneDigits,
} from '@apartment/shared';
import type { VendorCreateResult, VendorResponse, VendorSearchResult } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Vendor directory (tenant-scoped)
//
// Vendors have no login accounts (PLAN.md §13, ADR 007): they are contacted by
// the existing email magic link and, manually, by a wa.me deep link the admin
// clicks themselves. Nothing in here sends WhatsApp messages - there is no
// WhatsApp/BSP integration in this codebase.
//
// Phone numbers are normalized to E.164 by the shared Zod transform, so every
// phone that reaches this file (and therefore the database) is already
// `+92XXXXXXXXXX`.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/** Hard cap on autocomplete results - the dropdown never needs more. */
const SEARCH_LIMIT = 10;

/**
 * True when the query was clearly meant as a phone number (rather than a name
 * that happens to contain a digit): at least 3 digits and nothing but digits
 * and phone punctuation. Prevents "Tower 2 Plumbing" from adding a `phone
 * contains '2'` clause that would match nearly every vendor.
 */
function looksLikePhoneQuery(query: string): boolean {
  return phoneDigits(query).length >= 3 && /^[+\d][\d\s()+-]*$/.test(query);
}

/**
 * Digit patterns to match a typed phone against the stored E.164 value. Storage
 * drops the national trunk 0 (0300 1234567 is stored as +923001234567), so a
 * query typed that way must also be matched without the leading zeros.
 */
function phoneSearchPatterns(query: string): string[] {
  const digits = phoneDigits(query);
  const patterns = new Set<string>([digits]);
  const withoutTrunkZero = digits.replace(/^0+/, '');
  if (withoutTrunkZero) patterns.add(withoutTrunkZero);
  return [...patterns];
}

type VendorRecord = Prisma.VendorGetPayload<Record<string, never>>;

function formatVendor(v: VendorRecord): VendorResponse {
  return {
    id: v.id,
    societyId: v.societyId,
    name: v.name,
    phone: v.phone ?? null,
    email: v.email ?? null,
    notes: v.notes ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function formatSearchResult(v: VendorRecord): VendorSearchResult {
  return { id: v.id, name: v.name, phone: v.phone ?? null, email: v.email ?? null };
}

// ── GET /api/v1/vendors/search?q=<query> ───────────────────────────────────
// Assignment-form autocomplete. Matches name OR phone, scoped to the caller's
// society, capped at 10 rows. An empty query returns the most recently added
// vendors so a vendor used last week is one click away rather than retyped.
router.get(
  '/search',
  requireAuth,
  loadMembership,
  requireRole('read', 'vendor'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

      const where: Prisma.VendorWhereInput = { societyId, deletedAt: null };
      if (query) {
        // Match the typed text against the name, and the digits against the
        // stored E.164 phone, so "0300 123", "+92 300" and "923001234567"
        // all hit the same row.
        const or: Prisma.VendorWhereInput[] = [
          { name: { contains: query, mode: 'insensitive' } },
        ];
        if (looksLikePhoneQuery(query)) {
          for (const pattern of phoneSearchPatterns(query)) {
            or.push({ phone: { contains: pattern } });
          }
        }
        where.OR = or;
      }

      const vendors = await prisma.vendor.findMany({
        where,
        orderBy: query ? { name: 'asc' } : { createdAt: 'desc' },
        take: SEARCH_LIMIT,
      });

      sendSuccess(res, vendors.map(formatSearchResult));
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/vendors ───────────────────────────────────────────────────
// Create a vendor. Used both by any future vendor management screen and by the
// inline "Add ... as new vendor" path on the assignment form - the same code,
// normalization and audit entry either way (no duplicated create logic).
//
// A name plus **at least one** of phone/email is required (shared schema).
//
// Idempotent on whichever channel was supplied: a phone (or, for an email-only
// vendor, an email) already on file for this society is the same vendor, so the
// existing record is returned with `alreadyExisted: true` rather than creating a
// near-duplicate the admin then has to clean up. Never matches on a null phone -
// that would return an arbitrary email-only vendor as "already existed".
router.post(
  '/',
  requireAuth,
  loadMembership,
  requireRole('create', 'vendor'),
  async (req, res, next) => {
    try {
      const input = CreateVendorSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const duplicateWhere: Prisma.VendorWhereInput | null = input.phone
        ? { phone: input.phone }
        : input.email
          ? { email: input.email }
          : null;

      const existing = duplicateWhere
        ? await prisma.vendor.findFirst({ where: { societyId, deletedAt: null, ...duplicateWhere } })
        : null;

      if (existing) {
        const result: VendorCreateResult = { ...formatVendor(existing), alreadyExisted: true };
        sendSuccess(res, result);
        return;
      }

      const vendor = await prisma.vendor.create({
        data: {
          societyId,
          name: input.name,
          phone: input.phone,
          email: input.email ?? null,
          notes: input.notes ?? null,
        },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'VENDOR_CREATED',
        entityType: 'vendor',
        entityId: vendor.id,
        after: { name: vendor.name, phone: vendor.phone, email: vendor.email },
      });

      const result: VendorCreateResult = { ...formatVendor(vendor), alreadyExisted: false };
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/v1/vendors/:id ──────────────────────────────────────────────
// Edit a vendor's details - including filling in the channel it was missing.
// Without this, an admin who clicked "save" before realising a vendor had no
// email would have to create a duplicate vendor to fix it.
//
// The at-least-one-contact rule is re-checked against the MERGED record, not the
// patch: `{ phone: null }` alone is fine while stored email is set, and is
// rejected when the stored row has no email either.
router.patch(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('update', 'vendor'),
  async (req, res, next) => {
    try {
      const input = UpdateVendorSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const before = await prisma.vendor.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });
      if (!before) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Vendor not found');

      const merged = {
        phone: input.phone !== undefined ? input.phone : before.phone,
        email: input.email !== undefined ? input.email : before.email,
      };
      if (!hasVendorContact(merged)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `${VENDOR_CONTACT_ERROR} - this vendor would be left with no way to contact them`
        );
      }

      const vendor = await prisma.vendor.update({
        where: { id: before.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'VENDOR_UPDATED',
        entityType: 'vendor',
        entityId: vendor.id,
        before: { name: before.name, phone: before.phone, email: before.email },
        after: { name: vendor.name, phone: vendor.phone, email: vendor.email },
      });

      sendSuccess(res, formatVendor(vendor));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/vendors/:id ────────────────────────────────────────────────
// Single vendor, tenant-scoped (kept last so it can't shadow /search).
router.get(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('read', 'vendor'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const vendor = await prisma.vendor.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });
      if (!vendor) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Vendor not found');
      sendSuccess(res, formatVendor(vendor));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
