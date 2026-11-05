import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { PermissionKey, PermissionScope } from '@/features/auth/types/auth.types'
import { hasPermission } from '@/lib/permissions/permissionChecker'
import { AccessDenied } from '@/components/common/AccessDenied'
import { LoadingScreen } from '@/components/common/LoadingScreen'

export interface ProtectedRouteProps {
  requiredPermission?: PermissionKey | PermissionKey[]
  requiredScope?: PermissionScope
  children?: ReactNode
}

/**
 * Ensures user is authenticated and does not require password change.
 * If authentication is in flight, displays loading screen (no brief flash).
 * Optionally verifies required permissions before rendering.
 */
export function ProtectedRoute({
  requiredPermission,
  requiredScope,
  children,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen message="Checking authorization..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Enforce mandatory password change before accessing any protected application routes
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  // Permission authorization check
  if (requiredPermission && !hasPermission(user, requiredPermission, requiredScope)) {
    return <AccessDenied />
  }

  return children ? <>{children}</> : <Outlet />
}

