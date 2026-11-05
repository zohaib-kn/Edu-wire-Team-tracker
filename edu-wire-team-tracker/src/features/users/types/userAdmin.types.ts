import type { UserRole } from '@/features/auth/types/auth.types'

export type AccountStatus = 'active' | 'inactive' | 'locked' | string

export interface ManagedUser {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  branch?: string
  branchId?: string
  teams?: string[]
  status?: AccountStatus
  isActive?: boolean
  lastLogin?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface UserFilterParams {
  q?: string
  branch?: string
  role?: string
  status?: string
  page?: number
  limit?: number
}

export interface UsersListResponse {
  users: ManagedUser[]
  total?: number
  page?: number
  limit?: number
  totalPages?: number
}

export interface CreateUserPayload {
  name: string
  email: string
  phone?: string
  role: string
  branch: string
  teams?: string[]
  temporaryPassword?: string
}

export interface UpdateUserPayload {
  name?: string
  phone?: string
  role?: string
  branch?: string
  teams?: string[]
  status?: AccountStatus
  isActive?: boolean
}

export interface ResetPasswordResponse {
  message?: string
  temporaryPassword?: string
}

