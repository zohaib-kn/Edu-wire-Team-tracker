import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError.js'
import type { PermissionScope } from '../models/Role.js'

const SCOPE_RANK: Record<PermissionScope, number> = {
  own: 1,
  team: 2,
  branch: 3,
  all: 4,
}

export function isScopeSatisfied(
  userScope: PermissionScope | undefined,
  requiredScope: PermissionScope | undefined,
): boolean {
  if (!requiredScope) return true
  if (!userScope) return false
  return (SCOPE_RANK[userScope] ?? 0) >= (SCOPE_RANK[requiredScope] ?? 0)
}

/**
 * Reusable permission authorization middleware.
 * Verifies that the authenticated user possesses the specified permission key
 * with an equal or greater scope level.
 */
export function requirePermission(
  requiredKey: string,
  requiredScope?: PermissionScope,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required', 'UNAUTHORIZED'))
    }

    // Super Admin has unrestricted access to all endpoints
    if (req.user.role === 'Super Admin') {
      return next()
    }

    const matchedPermission = req.user.permissions.find(
      (p) => p.key === requiredKey,
    )

    if (!matchedPermission) {
      return next(
        AppError.forbidden(
          `Permission denied: '${requiredKey}' is required to access this resource.`,
          'INSUFFICIENT_PERMISSIONS',
        ),
      )
    }

    if (requiredScope && !isScopeSatisfied(matchedPermission.scope, requiredScope)) {
      return next(
        AppError.forbidden(
          `Permission scope mismatch: requires scope '${requiredScope}', but current scope is '${matchedPermission.scope}'.`,
          'SCOPE_INSUFFICIENT',
        ),
      )
    }

    next()
  }
}

