import { Router } from 'express';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  createSocietyWithFirstAdmin,
} from '../lib/auth';
import { verifyGoogleIdToken } from '../lib/google-auth';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendEmail } from '../lib/email';
import {
  generateResetToken,
  hashResetToken,
  getResetTokenTtlMs,
  buildPasswordResetEmail,
  buildGoogleOnlyAccountEmail,
} from '../lib/password-reset';
import { passwordResetEmailLimiter, passwordResetIpLimiter } from '../lib/rate-limit';
import {
  SignupSchema,
  LoginSchema,
  InviteResidentSchema,
  GoogleAuthSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@apartment/shared';
import type { AuthResponse, MembershipProfile, UserProfile, GoogleAuthResponse } from '@apartment/shared';

const router = Router();

interface OutboundEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Send through the EmailProvider (ADR 004) and translate a delivery failure into
 * a 502 EMAIL_SEND_FAILED - a caller must never receive a "check your inbox"
 * success for an email that failed to leave the server. The provider scrubs SMTP
 * credentials from its error message, so the log line is safe.
 */
async function deliverEmail(to: string, email: OutboundEmail, kind: string): Promise<void> {
  try {
    await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
  } catch (err) {
    console.error(
      `[forgot-password] ${kind} email delivery failed:`,
      err instanceof Error ? err.message : err
    );
    throw new AppError(
      ErrorCodes.EMAIL_SEND_FAILED,
      502,
      'We could not send the email right now. Please try again in a moment.'
    );
  }
}

// ── POST /api/v1/auth/signup ────────────────────────────────────────────────
// Creates a Society + first COMMITTEE_ADMIN User + Membership in one transaction.
// This is tenant onboarding - the entry point for every new customer.
router.post('/signup', async (req, res, next) => {
  try {
    const input = SignupSchema.parse(req.body);

    // Check for existing email
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS, 409, 'A user with this email already exists');
    }

    // Check for existing society slug
    const existingSociety = await prisma.society.findUnique({ where: { slug: input.societySlug } });
    if (existingSociety) {
      throw new AppError(ErrorCodes.SLUG_ALREADY_EXISTS, 409, 'This society slug is already taken');
    }

    const passwordHash = await hashPassword(input.password);

    // Use a transaction to create Society + User + Membership atomically
    // (shared with Google Sign-Up - the only way a brand-new User may get a
    // Membership is this signup flow or an admin invite)
    const result = await createSocietyWithFirstAdmin({
      email: input.email,
      name: input.name,
      societyName: input.societyName,
      societySlug: input.societySlug,
      passwordHash,
    });

    // Generate tokens
    const accessToken = signAccessToken(result.user.id);
    const refreshToken = signRefreshToken(result.user.id, result.user.tokenVersion);

    // Set tokens as HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    const userProfile: UserProfile = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };

    const membershipProfile: MembershipProfile = {
      id: result.membership.id,
      societyId: result.society.id,
      societyName: result.society.name,
      societySlug: result.society.slug,
      role: 'COMMITTEE_ADMIN',
      unitId: null,
      status: 'ACTIVE',
    };

    const response = {
      user: userProfile,
      memberships: [membershipProfile],
      accessToken,
      refreshToken,
    };

    sendSuccess(res, response, 201);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/login ────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    // Google-only accounts have no password - they can only sign in via Google
    if (!user.passwordHash) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
    }

    // Load all active memberships for this user
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE', deletedAt: null },
      include: { society: true },
    });

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id, user.tokenVersion);

    setAuthCookies(res, accessToken, refreshToken);

    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const membershipProfiles: MembershipProfile[] = memberships.map((m) => ({
      id: m.id,
      societyId: m.societyId,
      societyName: m.society.name,
      societySlug: m.society.slug,
      role: m.role as import('@apartment/shared').Role,
      unitId: m.unitId,
      status: m.status as import('@apartment/shared').MembershipStatus,
    }));

    const response = {
      user: userProfile,
      memberships: membershipProfiles,
      accessToken,
      refreshToken,
    };

    sendSuccess(res, response);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/google/config ─────────────────────────────────────────
// Public runtime config for the Google button. The OAuth *client ID* is public
// by design (browsers send it to Google), so exposing it here leaks nothing.
//
// Why this exists: Next.js inlines NEXT_PUBLIC_* at BUILD time, so a frontend
// host that didn't have NEXT_PUBLIC_GOOGLE_CLIENT_ID when it built (a common
// Vercel miss) would hide the Google button with no visible clue. The button
// falls back to this at runtime, so it works regardless of the build env.
router.get('/google/config', (_req, res) => {
  sendSuccess(res, { clientId: process.env.GOOGLE_CLIENT_ID || null });
});

// ── POST /api/v1/auth/google ───────────────────────────────────────────────
// Google Sign-In (GSI): the frontend sends the Google ID token; we verify it
// server-side (signature, audience, expiry) and never trust an unverified token.
//   mode='signin' → link the Google account to an existing User by verified
//                   email + log in. Unknown email → 401, NO account is created
//                   (Google auth must never self-grant access - a Membership
//                   only ever comes from the signup flow or an admin invite).
//   mode='signup' → tenant onboarding, exactly like POST /signup: creates a
//                   Society + first COMMITTEE_ADMIN User + Membership in one
//                   transaction (reuses createSocietyWithFirstAdmin).
router.post('/google', async (req, res, next) => {
  try {
    const input = GoogleAuthSchema.parse(req.body);

    // Google has already verified email ownership - that is what makes linking
    // a Google account to an existing email-based User safe.
    const profile = await verifyGoogleIdToken(input.idToken);
    if (!profile.email || !profile.emailVerified) {
      throw new AppError(
        ErrorCodes.INVALID_CREDENTIALS,
        401,
        'This Google account does not have a verified email'
      );
    }
    const email = profile.email.toLowerCase();

    if (input.mode === 'signup') {
      // Tenant onboarding - requires the same society fields as POST /signup
      if (!input.societyName || !input.societySlug) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          'Society name and society URL are required to create a new society'
        );
      }

      // Same conflict checks as the password signup flow (case-insensitive so a
      // Google email can't silently create a duplicate of an existing account)
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (existingUser) {
        throw new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS, 409, 'A user with this email already exists');
      }

      const existingSociety = await prisma.society.findUnique({
        where: { slug: input.societySlug },
      });
      if (existingSociety) {
        throw new AppError(ErrorCodes.SLUG_ALREADY_EXISTS, 409, 'This society slug is already taken');
      }

      const result = await createSocietyWithFirstAdmin({
        email,
        name: profile.name || email.split('@')[0] || 'New User',
        societyName: input.societyName,
        societySlug: input.societySlug,
        googleId: profile.sub,
      });

      const accessToken = signAccessToken(result.user.id);
      const refreshToken = signRefreshToken(result.user.id, result.user.tokenVersion);
      setAuthCookies(res, accessToken, refreshToken);

      const userProfile: UserProfile = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      };
      const membershipProfile: MembershipProfile = {
        id: result.membership.id,
        societyId: result.society.id,
        societyName: result.society.name,
        societySlug: result.society.slug,
        role: 'COMMITTEE_ADMIN',
        unitId: null,
        status: 'ACTIVE',
      };

      const response: GoogleAuthResponse = {
        user: userProfile,
        memberships: [membershipProfile],
        accessToken,
        refreshToken,
      };

      sendSuccess(res, response, 201);
      return;
    }

    // ── mode === 'signin' ──
    // Only link/log in an EXISTING user - never create a User or Membership here.
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) {
      throw new AppError(
        ErrorCodes.INVALID_CREDENTIALS,
        401,
        'No account exists for this email. Ask your society admin to invite you, or create a new society.'
      );
    }

    // Defensive: a different Google account must never be able to claim this email
    if (user.googleId && user.googleId !== profile.sub) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        409,
        'This email is already linked to a different Google account'
      );
    }

    // Link the Google account to the existing user (safe because Google verified
    // email ownership). Mark emailVerified - Google already proved it.
    const linked = user.googleId ? false : true;
    if (linked) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.sub, emailVerified: true },
      });
    }

    // Load all active memberships for this user
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE', deletedAt: null },
      include: { society: true },
    });

    // Account linking is a security-relevant mutation - record it per active
    // society. (Password login writes no audit entry; this is the same policy.)
    if (linked) {
      for (const m of memberships) {
        await logAudit({
          societyId: m.societyId,
          actorUserId: user.id,
          action: 'GOOGLE_ACCOUNT_LINKED',
          entityType: 'user',
          entityId: user.id,
          after: { email, googleId: profile.sub },
        });
      }
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id, user.tokenVersion);
    setAuthCookies(res, accessToken, refreshToken);

    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const membershipProfiles: MembershipProfile[] = memberships.map((m) => ({
      id: m.id,
      societyId: m.societyId,
      societyName: m.society.name,
      societySlug: m.society.slug,
      role: m.role as import('@apartment/shared').Role,
      unitId: m.unitId,
      status: m.status as import('@apartment/shared').MembershipStatus,
    }));

    const response: GoogleAuthResponse = {
      user: userProfile,
      memberships: membershipProfiles,
      accessToken,
      refreshToken,
      linked,
    };

    sendSuccess(res, response);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/forgot-password ──────────────────────────────────────
// Requests a password reset link (delivered through the EmailProvider - ADR
// 004, Gmail SMTP via Nodemailer). Behavior by account:
//   • password-having account → single-use, time-limited reset link via email
//   • Google-only account (passwordHash = null) → informational email pointing
//     at Google Sign-In - no reset link, no token, no password is ever created
//   • unknown email → 404 EMAIL_NOT_FOUND (nothing created or sent)
// Rate-limited per email and per IP.
//
// NOTE: if the SMTP send fails we surface EMAIL_SEND_FAILED rather than a
// success message, so the user is never told to "check your inbox" for an email
// that never left the server. The reset token stays valid for a retry.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const input = ForgotPasswordSchema.parse(req.body);
    const emailKey = input.email.toLowerCase();

    const emailLimit = passwordResetEmailLimiter.check(emailKey);
    const ipLimit = passwordResetIpLimiter.check(req.ip || req.socket.remoteAddress || 'unknown');
    if (!emailLimit.allowed || !ipLimit.allowed) {
      throw new AppError(ErrorCodes.RATE_LIMITED, 429, 'Too many requests. Please try again later.');
    }

    const user = await prisma.user.findUnique({ where: { email: emailKey } });

    if (!user) {
      throw new AppError(ErrorCodes.EMAIL_NOT_FOUND, 404, 'No account found with this email address.');
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

    // Google-only account: no password exists to reset - explain and point at
    // Google Sign-In. Never issue a reset token for a passwordless account.
    if (!user.passwordHash) {
      const loginUrl = `${frontendUrl}/login`;
      const googleEmail = buildGoogleOnlyAccountEmail(loginUrl);
      await deliverEmail(user.email, googleEmail, 'Google-only');
      sendSuccess(res, { message: 'This account uses Google Sign-In. Please sign in with Google instead.', googleOnly: true });
      return;
    }

    // Housekeeping: drop this user's expired tokens so the table doesn't grow.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    // Single-use, time-limited token - only the SHA-256 hash is stored.
    const { raw, hash } = generateResetToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + getResetTokenTtlMs()),
      },
    });

    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(raw)}`;
    const email = buildPasswordResetEmail(resetUrl);
    await deliverEmail(user.email, email, 'reset');

    sendSuccess(res, { message: 'A password reset link has been sent to your email. Check your inbox.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/reset-password ───────────────────────────────────────
// Consumes a single-use reset token (from the emailed link) and sets a new
// password. Validates expiry and single-use; bumps the user's tokenVersion so
// every outstanding refresh token dies (other sessions must log in again).
// The token consumption and password update are atomic, and the consumed-token
// guard is an updateMany(usedAt: null) so two racing requests can't both win.
router.post('/reset-password', async (req, res, next) => {
  try {
    const input = ResetPasswordSchema.parse(req.body);
    const tokenHash = hashResetToken(input.token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      throw new AppError(ErrorCodes.TOKEN_INVALID, 400, 'This reset link is invalid. Please request a new one.');
    }
    if (resetToken.usedAt) {
      throw new AppError(ErrorCodes.TOKEN_INVALID, 400, 'This reset link has already been used. Please request a new one.');
    }
    if (resetToken.expiresAt.getTime() < Date.now()) {
      throw new AppError(ErrorCodes.TOKEN_EXPIRED, 400, 'This reset link has expired. Please request a new one.');
    }

    const passwordHash = await hashPassword(input.password);

    // Atomic: mark used (guarded so a token can't be double-spent) + set the
    // new password + bump tokenVersion (invalidates all outstanding refresh
    // tokens, force-logging-out any other sessions).
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) {
        throw new AppError(ErrorCodes.TOKEN_INVALID, 400, 'This reset link has already been used. Please request a new one.');
      }
      return tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
    });

    // Security: any other outstanding (unused) links for this user are now dead.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId, usedAt: null },
    });

    // Audit per active society - never the password itself, only that a reset
    // occurred (same policy as Google account linking; PLAN.md §4.4).
    const memberships = await prisma.membership.findMany({
      where: { userId: resetToken.userId, status: 'ACTIVE', deletedAt: null },
    });
    for (const m of memberships) {
      await logAudit({
        societyId: m.societyId,
        actorUserId: resetToken.userId,
        action: 'PASSWORD_RESET',
        entityType: 'user',
        entityId: resetToken.userId,
        after: { resetAt: new Date().toISOString() },
      });
    }

    sendSuccess(res, { message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout ───────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  // TODO: Blacklist refresh token in Redis to prevent reuse after logout
  // This requires ioredis integration (Phase 1 or Phase 0 follow-up)

  // Clear the auth cookies
  clearAuthCookies(res);

  sendSuccess(res, { message: 'Logged out successfully' });
});

// ── GET /api/v1/auth/me ────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Not authenticated');
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id, status: 'ACTIVE', deletedAt: null },
      include: { society: true },
    });

    const membershipProfiles: MembershipProfile[] = memberships.map((m) => ({
      id: m.id,
      societyId: m.societyId,
      societyName: m.society.name,
      societySlug: m.society.slug,
      role: m.role as import('@apartment/shared').Role,
      unitId: m.unitId,
      status: m.status as import('@apartment/shared').MembershipStatus,
    }));

    const response: AuthResponse = {
      user: req.user,
      memberships: membershipProfiles,
    };

    sendSuccess(res, response);
  } catch (err) {
    next(err);
  }
});// ── POST /api/v1/auth/refresh ──────────────────────────────────────────────
// Accepts the refresh token from the `x-refresh-token` header (cross-origin safe,
// stored client-side) or the httpOnly `refreshToken` cookie. Returns the new
// access + refresh tokens in the body so the client can persist them.
router.post('/refresh', async (req, res, next) => {
  try {
    const token =
      (req.headers['x-refresh-token'] as string | undefined) ||
      req.cookies?.refreshToken;
    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Refresh token required');
    }

    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'User not found');
    }

    // Refresh tokens are stateless JWTs, so session invalidation is enforced
    // via a version claim: a token signed before the last password reset (or
    // before tokenVersion existed - treated as 0) no longer matches.
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new AppError(ErrorCodes.TOKEN_INVALID, 401, 'Session expired. Please sign in again.');
    }

    const newAccessToken = signAccessToken(user.id);
    const newRefreshToken = signRefreshToken(user.id, user.tokenVersion);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    sendSuccess(res, {
      message: 'Token refreshed',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/auth/memberships ───────────────────────────────────────────
// List all memberships for the current society (admin)
router.get('/memberships', requireAuth, loadMembership, requireRole('read', 'membership'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;

    const memberships = await prisma.membership.findMany({
      where: { societyId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        unit: { select: { unitNumber: true, building: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userName: m.user.name,
      userEmail: m.user.email,
      role: m.role,
      unitId: m.unitId,
      unitNumber: m.unit ? `${m.unit.building?.name ? m.unit.building.name + ' - ' : ''}${m.unit.unitNumber}` : null,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }));

    sendSuccess(res, data);
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/memberships/:id/revoke ───────────────────────────────
// Revoke a membership and auto-cancel all pending/approved visitor passes for that unit.
router.post('/memberships/:id/revoke', requireAuth, loadMembership, requireRole('update', 'membership'), async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const membership = await prisma.membership.findFirst({
      where: { id: req.params.id, societyId },
    });
    if (!membership) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Membership not found');
    if (membership.status === 'REVOKED') throw new AppError(ErrorCodes.CONFLICT, 409, 'Membership is already revoked');

    // Revoke the membership
    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'REVOKED', deletedAt: new Date() },
    });

    // Auto-cancel all pending/approved visitor passes for this unit
    if (membership.unitId) {
      const cancelledPasses = await prisma.visitorPass.updateMany({
        where: {
          societyId,
          unitId: membership.unitId,
          status: { in: ['PENDING', 'APPROVED'] },
          deletedAt: null,
        },
        data: { status: 'CANCELLED', deletedAt: new Date() },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'VISITOR_PASSES_AUTO_CANCELLED',
        entityType: 'membership',
        entityId: membership.id,
        after: { cancelledCount: cancelledPasses.count, unitId: membership.unitId },
      });
    }

    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: 'MEMBERSHIP_REVOKED',
      entityType: 'membership',
      entityId: membership.id,
      before: { status: membership.status, userId: membership.userId },
      after: { status: 'REVOKED' },
    });

    sendSuccess(res, { message: 'Membership revoked. Visitor passes cancelled.' });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/invite ───────────────────────────────────────────────
// Committee admin invites a user by email → creates User (if new) + Membership.
// Accepts `role`: 'RESIDENT' (default, requires unitId), 'SECURITY_GUARD', or 'VENDOR' (no unitId).
router.post('/invite', requireAuth, loadMembership, requireRole('invite', 'membership'), async (req, res, next) => {
  try {
    const input = InviteResidentSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) {
      throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
    }

    const targetRole = input.role || 'RESIDENT';

    // Verify unit if role requires it
    if (targetRole === 'RESIDENT') {
      if (!input.unitId) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Unit is required for residents');
      }
      const unit = await prisma.unit.findFirst({
        where: { id: input.unitId, societyId, deletedAt: null },
      });
      if (!unit) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found in this society');
      }
    }

    // Find existing user or create a new one
    let user = await prisma.user.findUnique({ where: { email: input.email } });
    let isNewUser = false;
    let tempPassword: string | undefined;

    if (!user) {
      // Generate a temporary password for new users
      tempPassword = Math.random().toString(36).slice(-12);
      const passwordHash = await hashPassword(tempPassword);
      user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
        },
      });
      isNewUser = true;
    }

    // Check if membership already exists for this user+society (role-specific)
    const existingMembership = await prisma.membership.findFirst({
      where: { userId: user.id, societyId, role: targetRole, deletedAt: null },
    });

    if (existingMembership) {
      throw new AppError(ErrorCodes.CONFLICT, 409, `This user already has a ${targetRole.toLowerCase()} membership in this society`);
    }

    // Check for soft-deleted membership to reactivate
    const deletedMembership = await prisma.membership.findFirst({
      where: { userId: user.id, societyId, role: targetRole, deletedAt: { not: null } },
    });

    if (deletedMembership) {
      await prisma.membership.update({
        where: { id: deletedMembership.id },
        data: { status: 'ACTIVE', deletedAt: null, unitId: input.unitId || null },
      });
    } else {
      // Create new membership
      await prisma.membership.create({
        data: {
          userId: user.id,
          societyId,
          unitId: targetRole === 'RESIDENT' ? input.unitId! : null,
          role: targetRole,
          status: 'ACTIVE',
        },
      });
    }

    // Audit
    await logAudit({
      societyId,
      actorUserId: req.user!.id,
      action: isNewUser ? 'MEMBER_INVITED_NEW' : 'MEMBER_INVITED_EXISTING',
      entityType: 'membership',
      entityId: deletedMembership?.id || 'new',
      after: { email: input.email, role: targetRole, unitId: input.unitId || null },
    });

    sendSuccess(res, {
      message: isNewUser
        ? `Invited ${input.email} as ${targetRole.replace(/_/g, ' ')}. They can log in with the temporary password below.`
        : `${input.email} has been added as ${targetRole.replace(/_/g, ' ')}.`,
      user: { id: user.id, email: user.email, name: user.name },
      ...(isNewUser ? { tempPassword } : {}),
    }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
