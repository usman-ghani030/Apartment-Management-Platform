import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../lib/app-error';
import { verifyAccessToken } from '../lib/auth';
import { prisma } from '../lib/prisma';
import type { UserProfile, MembershipProfile } from '@apartment/shared';

// Extend Express Request to include authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      membership?: MembershipProfile; // Active membership for the current society context
    }
  }
}

/**
 * Extracts and verifies the access token from x-access-token header
 * (used for programmatic/API access) or from the 'token' cookie.
 */
function extractToken(req: Request): string | null {
  // Check header first (for API clients/tests)
  const authHeader = req.headers['x-access-token'] as string | undefined;
  if (authHeader) return authHeader;

  // Check cookie (for browser-based auth)
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  return null;
}

/**
 * Required auth middleware.
 * Returns 401 if no valid token is provided.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'Authentication required');
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 401, 'User not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    // JWT errors (expired, invalid signature, etc.)
    next(new AppError(ErrorCodes.TOKEN_INVALID, 401, 'Invalid or expired token'));
  }
}

/**
 * Optional auth middleware.
 * Attaches user info if a valid token exists, but does not block the request.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }
  } catch {
    // Silently continue without auth
  }
  next();
}

/**
 * Load the active membership for the current user.
 *
 * Priority:
 * 1. If `x-society-id` header is present, load membership for that specific society.
 * 2. If only one active membership exists, auto-detect it (common case in Phase 1).
 * 3. If multiple memberships exist and no header is given, the route handler
 *    will require the frontend to include the header.
 *
 * Sets req.membership so RBAC middleware can use it.
 */
export async function loadMembership(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  try {
    const societyId = req.headers['x-society-id'] as string | undefined;

    // If no specific society requested, try auto-detecting from single membership
    if (!societyId) {
      const memberships = await prisma.membership.findMany({
        where: { userId: req.user.id, status: 'ACTIVE', deletedAt: null },
        include: { society: true },
      });

      if (memberships.length === 1) {
        const m = memberships[0];
        req.membership = {
          id: m.id,
          societyId: m.societyId,
          societyName: m.society.name,
          societySlug: m.society.slug,
          role: m.role as import('@apartment/shared').Role,
          unitId: m.unitId,
          status: m.status as import('@apartment/shared').MembershipStatus,
        };
      }
      // If multiple memberships, user needs to send x-society-id header
      next();
      return;
    }

    // Load membership for a specific society
    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        societyId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (membership) {
      const society = await prisma.society.findUnique({ where: { id: societyId } });
      req.membership = {
        id: membership.id,
        societyId: membership.societyId,
        societyName: society?.name ?? '',
        societySlug: society?.slug ?? '',
        role: membership.role as import('@apartment/shared').Role,
        unitId: membership.unitId,
        status: membership.status as import('@apartment/shared').MembershipStatus,
      };
    }
  } catch (err) {
    console.error('[loadMembership] Failed to load membership:', err instanceof Error ? err.stack || err.message : err);
    // Silently continue without membership — the route will check req.membership
  }
  next();
}
