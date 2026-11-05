export type UserRole = 'Super Admin' | 'Branch Admin' | 'Team Lead' | 'Member' | string

export type PermissionKey =
  | 'task.view'
  | 'task.create'
  | 'task.edit'
  | 'task.status'
  | 'task.delete'
  | 'report.view'
  | 'user.manage'
  | 'team.manage'
  | 'branch.manage'
  | 'role.manage'
  | (string & {})

export type PermissionScope = 'own' | 'team' | 'branch' | 'all'

export interface UserPermissionItem {
  permission: PermissionKey
  scope?: PermissionScope
}

export type PermissionEntry = PermissionKey | UserPermissionItem

export interface User {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  role: UserRole
  branchId?: string | null
  branch?: string | null
  teamId?: string | null
  teams?: string[]
  mustChangePassword: boolean
  status?: 'active' | 'inactive' | 'locked' | string
  permissions: PermissionEntry[]
  avatarUrl?: string
  createdAt?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword?: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export interface RefreshResponse {
  accessToken: string
  user?: User
}

export interface ApiErrorResponse {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  message?: string
}

