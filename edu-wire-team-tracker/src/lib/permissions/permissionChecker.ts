import type {
  PermissionEntry,
  PermissionKey,
  PermissionScope,
  User,
} from '@/features/auth/types/auth.types'
import { isScopeSatisfied } from './permissions'

export interface CheckPermissionOptions {
  scope?: PermissionScope
  requireAll?: boolean
}

/**
 * Checks if a user possesses the requested permission(s) and scope.
 * Authorization logic is strictly permission-based (no role name comparisons).
 */
export function hasPermission(
  user: User | null | undefined,
  requiredPermission: PermissionKey | PermissionKey[],
  options?: CheckPermissionOptions | PermissionScope,
): boolean {
  if (!user || !user.permissions || user.permissions.length === 0) {
    return false
  }

  const opts: CheckPermissionOptions =
    typeof options === 'string' ? { scope: options } : options || {}

  const requiredList = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission]

  if (requiredList.length === 0) {
    return true
  }

  // Fast-path: Check for wildcard permission
  const hasWildcard = user.permissions.some((entry) => {
    if (typeof entry === 'string') return entry === '*'
    return entry.permission === '*'
  })
  if (hasWildcard) return true

  const checkSinglePermission = (perm: PermissionKey): boolean => {
    return user.permissions.some((entry: PermissionEntry) => {
      if (typeof entry === 'string') {
        return entry === perm
      }
      if (entry && typeof entry === 'object' && entry.permission === perm) {
        return isScopeSatisfied(entry.scope, opts.scope)
      }
      return false
    })
  }

  if (opts.requireAll) {
    return requiredList.every(checkSinglePermission)
  }

  return requiredList.some(checkSinglePermission)
}

