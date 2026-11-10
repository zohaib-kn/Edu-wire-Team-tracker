import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoadingScreen } from '@/components/common/LoadingScreen'

export interface RequirePasswordChangeProps {
  children?: ReactNode
}

/**
 * Route guard dedicated to /change-password.
 * Allows any authenticated user (whether changing password voluntarily or when mustChangePassword is true).
 * Unauthenticated users are redirected to /login.
 */
export function RequirePasswordChange({ children }: RequirePasswordChangeProps) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen message="Checking account status..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  return children ? <>{children}</> : <Outlet />
}

