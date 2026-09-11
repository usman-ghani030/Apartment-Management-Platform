import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { prisma } from './prisma';

// ── Password hashing (bcryptjs) ────────────────────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT Tokens ──────────────────────────────────────────────────────────────

interface TokenPayload {
  userId: string;
  // Refresh-token version (bumped on password reset to invalidate all sessions).
  // Absent on tokens signed before the versioning change — treated as 0.
  tokenVersion?: number;
}

const accessSecret = () => process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || 'dev-fallback-refresh-secret';

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId } satisfies TokenPayload, accessSecret(), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
}

export function signRefreshToken(userId: string, tokenVersion = 0): string {
  return jwt.sign({ userId, tokenVersion } satisfies TokenPayload, refreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, accessSecret()) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, refreshSecret()) as TokenPayload;
}

// ── Session cookie setup (shared by login / signup / google / refresh) ───────
// The access token lives in the `token` httpOnly cookie; the refresh token in
// `refreshToken`. Both are also returned in the response body so the frontend
// can persist them for cross-origin API calls (x-access-token / x-refresh-token).
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearAuthCookies(res: Response): void {
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
}

// ── Tenant onboarding (shared by password signup + Google signup) ────────────
// Creates Society + first COMMITTEE_ADMIN User + Membership in one transaction.
// This is the ONLY place a brand-new User may be created with a Membership —
// Google Sign-In must never create a Membership any other way (see PLAN.md
// and the Google-auth business rule: no membership without invite or signup).
interface NewSocietyAdminInput {
  email: string;
  name: string;
  societyName: string;
  societySlug: string;
  passwordHash?: string | null;
  googleId?: string | null;
}

export async function createSocietyWithFirstAdmin(input: NewSocietyAdminInput) {
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
        passwordHash: input.passwordHash ?? null,
        googleId: input.googleId ?? null,
        // Google has already verified email ownership for Google-created accounts
        emailVerified: input.googleId ? true : false,
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

  return result;
}
