import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../lib/app-error';
import { can } from '../lib/permissions';
import type { AuthAction, AuthResource } from '../lib/permissions';
import type { Role } from '@apartment/shared';

/**
 * RBAC middleware factory.
 *
 * Usage:
 *   router.post('/buildings', requireAuth, requireRole('create', 'building'), handler)
 *   router.get('/tickets', requireAuth, requireRole('read', 'ticket'), handler)
 *
 * The middleware checks the user's membership role (loaded by loadMembership middleware)
 * against the permission matrix. Returns 403 if not authorized.
 */
export function requireRole(action: AuthAction, resource: AuthResource) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.membership) {
      next(new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required for this action'));
      return;
    }

    const role = req.membership.role as Role;

    if (!can(role, action, resource)) {
      next(
        new AppError(
          ErrorCodes.FORBIDDEN,
          403,
          `Role '${role}' is not allowed to ${action} ${resource}`
        )
      );
      return;
    }

    next();
  };
}
