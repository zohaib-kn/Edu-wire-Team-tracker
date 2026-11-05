import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { LoadingScreen } from '@/components/common/LoadingScreen'

export interface GuestRouteProps {
  children?: ReactNode
}

/**
 * Route guard for unauthenticated pages (e.g. /login).
 * Redirects authenticated users to dashboard or change-password if mandatory.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen message="Checking session..." />
  }

  if (isAuthenticated && user) {
    if (user.mustChangePassword) {
      return <Navigate to="/change-password" replace />
    }
    const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard'
    return <Navigate to={fromPath} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

