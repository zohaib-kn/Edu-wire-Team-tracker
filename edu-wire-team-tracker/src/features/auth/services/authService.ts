import { apiClient, setAccessToken } from '@/lib/api/apiClient'
import type {
  AuthResponse,
  ChangePasswordPayload,
  LoginCredentials,
  RefreshResponse,
  User,
} from '../types/auth.types'

export const authService = {
  /**
   * Submits credentials to POST /api/v1/auth/login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials)
    setAccessToken(response.data.accessToken)
    return response.data
  },

  /**
   * Refreshes the session token via POST /api/v1/auth/refresh (uses httpOnly cookie)
   */
  async refresh(): Promise<RefreshResponse> {
    const response = await apiClient.post<RefreshResponse>('/auth/refresh')
    if (response.data.accessToken) {
      setAccessToken(response.data.accessToken)
    }
    return response.data
  },

  /**
   * Fetches current authenticated user data from GET /api/v1/auth/me
   */
  async getMe(): Promise<User> {
    const response = await apiClient.get<User | { user: User }>('/auth/me')
    // Handle both direct User return or wrapped { user: User }
    if ('user' in response.data) {
      return response.data.user
    }
    return response.data
  },

  /**
   * Submits password update to POST /api/v1/auth/change-password
   */
  async changePassword(
    payload: ChangePasswordPayload,
  ): Promise<{ success: boolean; user?: User; message?: string }> {
    const response = await apiClient.post<{
      success?: boolean
      user?: User
      message?: string
    }>('/auth/change-password', {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    })
    return {
      success: response.data.success ?? true,
      user: response.data.user,
      message: response.data.message,
    }
  },

  /**
   * Logs out user and invalidates session via POST /api/v1/auth/logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      setAccessToken(null)
    }
  },
}

