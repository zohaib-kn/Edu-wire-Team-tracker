import { apiClient } from '@/lib/api/apiClient'
import type {
  CreateUserPayload,
  ManagedUser,
  ResetPasswordResponse,
  UpdateUserPayload,
  UserFilterParams,
  UsersListResponse,
} from '../types/userAdmin.types'

export const userService = {
  /**
   * Fetches paginated list of staff users from GET /api/v1/users
   */
  async getUsers(filters?: UserFilterParams): Promise<UsersListResponse> {
    const params: Record<string, string | number> = {}

    if (filters?.q && filters.q.trim()) params.q = filters.q.trim()
    if (filters?.branch && filters.branch !== 'all') params.branch = filters.branch
    if (filters?.role && filters.role !== 'all') params.role = filters.role
    if (filters?.status && filters.status !== 'all') params.status = filters.status
    if (filters?.page) params.page = filters.page
    if (filters?.limit) params.limit = filters.limit

    const response = await apiClient.get<
      ManagedUser[] | UsersListResponse | { data: ManagedUser[]; total?: number }
    >('/users', { params })

    const raw = response.data

    if (Array.isArray(raw)) {
      return { users: raw, total: raw.length }
    }
    if (raw && typeof raw === 'object' && 'users' in raw && Array.isArray(raw.users)) {
      return raw as UsersListResponse
    }
    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray(raw.data)) {
      return {
        users: raw.data,
        total: (raw as { total?: number }).total ?? raw.data.length,
      }
    }

    return { users: [], total: 0 }
  },

  /**
   * Creates a new user via POST /api/v1/users
   */
  async createUser(payload: CreateUserPayload): Promise<ManagedUser> {
    const response = await apiClient.post<
      ManagedUser | { data: ManagedUser } | { user: ManagedUser }
    >('/users', payload)
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.user || raw) as ManagedUser
  },

  /**
   * Updates an existing user via PATCH /api/v1/users/:id
   */
  async updateUser(id: string, payload: UpdateUserPayload): Promise<ManagedUser> {
    const response = await apiClient.patch<
      ManagedUser | { data: ManagedUser } | { user: ManagedUser }
    >(`/users/${encodeURIComponent(id)}`, payload)
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.user || raw) as ManagedUser
  },

  /**
   * Triggers password reset via POST /api/v1/users/:id/reset-password
   */
  async resetPassword(id: string): Promise<ResetPasswordResponse> {
    const response = await apiClient.post<ResetPasswordResponse>(
      `/users/${encodeURIComponent(id)}/reset-password`,
      {},
    )
    return response.data || {}
  },

  /**
   * Toggles active/inactive status via PATCH /api/v1/users/:id
   */
  async toggleStatus(id: string, active: boolean): Promise<ManagedUser> {
    const response = await apiClient.patch<
      ManagedUser | { data: ManagedUser } | { user: ManagedUser }
    >(`/users/${encodeURIComponent(id)}`, {
      isActive: active,
      status: active ? 'active' : 'inactive',
    })
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.user || raw) as ManagedUser
  },
}

