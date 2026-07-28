import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/auth';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { SignupSchema, LoginSchema, InviteResidentSchema } from '@apartment/shared';
import type { AuthResponse, MembershipProfile, UserProfile } from '@apartment/shared';

const router = Router();

// ── POST /api/v1/auth/signup ────────────────────────────────────────────────
// Creates a Society + first COMMITTEE_ADMIN User + Membership in one transaction.
// This is tenant onboarding — the entry point for every new customer.
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
    const result = await prisma.$transaction(async (tx) => {
      const society = await tx.society.create({
        data: {
          name: input.societyName,
          slug: input.societySlug,
        },
      });

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          societyId: society.id,
          role: 'COMMITTEE_ADMIN',
          status: 'ACTIVE',
        },
      });

      // Audit: society created
      await tx.auditLog.create({
        data: {
          societyId: society.id,
          actorUserId: user.id,
          action: 'SOCIETY_CREATED',
          entityType: 'society',
          entityId: society.id,
          afterJson: { name: society.name, slug: society.slug },
        },
      });

      return { society, user, membership };
    });

    // Generate tokens
    const accessToken = signAccessToken(result.user.id);
    const refreshToken = signRefreshToken(result.user.id);

    // Set tokens as HTTP-only cookies
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

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
    const refreshToken = signRefreshToken(user.id);

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

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
    };

    sendSuccess(res, response);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout ───────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  // TODO: Blacklist refresh token in Redis to prevent reuse after logout
  // This requires ioredis integration (Phase 1 or Phase 0 follow-up)
  
  // Clear the auth cookies
  res.cookie('token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/',
  });

  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/',
  });

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
});

// ── POST /api/v1/auth/refresh ──────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Refresh token required');
    }

    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'User not found');
    }

    const newAccessToken = signAccessToken(user.id);
    const newRefreshToken = signRefreshToken(user.id);

    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    sendSuccess(res, { message: 'Token refreshed' });
  } catch (err) {
    next(err);
  }
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
