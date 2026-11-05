import type { ReactNode } from 'react'
import type { PermissionKey, PermissionScope } from '@/features/auth/types/auth.types'
import { usePermission } from '@/hooks/usePermission'

export interface CanProps {
  permission: PermissionKey | PermissionKey[]
  scope?: PermissionScope
  requireAll?: boolean
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Reusable permission gating component.
 * Renders children only when authenticated user has the specified permission(s).
 */
export function Can({
  permission,
  scope,
  requireAll,
  fallback = null,
  children,
}: CanProps) {
  const { can } = usePermission()

  const allowed = can(permission, { scope, requireAll })

  if (!allowed) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

