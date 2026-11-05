import type { PermissionKey, PermissionScope } from '@/features/auth/types/auth.types'

export type MatrixScope = 'none' | PermissionScope

export interface RolePermissionConfig {
  permission: PermissionKey
  scope: MatrixScope
}

export interface RoleItem {
  id: string
  name: string
  description?: string
  isSystem?: boolean
  permissions: RolePermissionConfig[]
  userCount?: number
  updatedAt?: string
}

export interface UpdateRolePayload {
  name?: string
  description?: string
  permissions: RolePermissionConfig[]
}

