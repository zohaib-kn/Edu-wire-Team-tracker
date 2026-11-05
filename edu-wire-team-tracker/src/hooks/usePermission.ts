import { useAuth } from '@/features/auth/hooks/useAuth'
import type { PermissionKey, PermissionScope } from '@/features/auth/types/auth.types'
import {
  hasPermission,
  type CheckPermissionOptions,
} from '@/lib/permissions/permissionChecker'

export function usePermission() {
  const { user } = useAuth()

  const can = (
    permission: PermissionKey | PermissionKey[],
    options?: CheckPermissionOptions | PermissionScope,
  ): boolean => {
    return hasPermission(user, permission, options)
  }

  return {
    can,
    userPermissions: user?.permissions ?? [],
  }
}

