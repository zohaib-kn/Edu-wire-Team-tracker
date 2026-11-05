import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { authService } from '@/features/auth/services/authService'
import type {
  ChangePasswordPayload,
  LoginCredentials,
  User,
} from '@/features/auth/types/auth.types'
import { onSessionExpired, setAccessToken } from '@/lib/api/apiClient'
import { extractApiError } from '@/lib/api/errorHandler'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Handle session expiration detected by apiClient 401 interceptor
  const handleSessionExpired = useCallback(() => {
    setUser(null)
    setAccessToken(null)
  }, [])

  useEffect(() => {
    onSessionExpired(handleSessionExpired)
  }, [handleSessionExpired])

  // Fetches current user profile from GET /api/v1/auth/me
  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const currentUser = await authService.getMe()
      setUser(currentUser)
      return currentUser
    } catch {
      setUser(null)
      return null
    }
  }, [])

  // Session restoration on initial page load / refresh using httpOnly cookie
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      try {
        // Attempt to exchange httpOnly refresh cookie for fresh access token
        const refreshResult = await authService.refresh()

        if (!isMounted) return

        if (refreshResult.user) {
          setUser(refreshResult.user)
        } else {
          // If refresh returned token only, fetch user profile
          const me = await authService.getMe()
          if (isMounted) setUser(me)
        }
      } catch {
        // If refresh fails (e.g. 401 or no cookie), user remains unauthenticated
        if (isMounted) {
          setUser(null)
          setAccessToken(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (credentials: LoginCredentials): Promise<User> => {
    try {
      const response = await authService.login(credentials)
      setUser(response.user)
      return response.user
    } catch (error) {
      const parsed = extractApiError(error)
      throw new Error(parsed.message, { cause: error })
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await authService.logout()
    } catch {
      // Clear client state even if network call failed
      setAccessToken(null)
    } finally {
      setUser(null)
    }
  }

  const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
    try {
      const response = await authService.changePassword(payload)
      if (response.user) {
        setUser(response.user)
      } else {
        // Re-fetch current user profile from server to guarantee authoritative state
        const updatedUser = await authService.getMe()
        setUser(updatedUser)
      }
    } catch (error) {
      const parsed = extractApiError(error)
      throw new Error(parsed.message, { cause: error })
    }
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    changePassword,
    refreshUser: fetchCurrentUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
