import { apiClient } from '@/lib/api/apiClient'
import type { RoleItem, UpdateRolePayload } from '../types/role.types'

export const roleService = {
  /**
   * Fetches roles from GET /api/v1/roles
   */
  async getRoles(): Promise<RoleItem[]> {
    const response = await apiClient.get<
      RoleItem[] | { roles: RoleItem[] } | { data: RoleItem[] }
    >('/roles')

    const raw = response.data
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') {
      if ('roles' in raw && Array.isArray(raw.roles)) return raw.roles
      if ('data' in raw && Array.isArray(raw.data)) return raw.data
    }
    return []
  },

  /**
   * Updates role permissions via PATCH /api/v1/roles/:id
   */
  async updateRole(id: string, payload: UpdateRolePayload): Promise<RoleItem> {
    const response = await apiClient.patch<
      RoleItem | { data: RoleItem } | { role: RoleItem }
    >(`/roles/${encodeURIComponent(id)}`, payload)

    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.role || raw) as RoleItem
  },
}

