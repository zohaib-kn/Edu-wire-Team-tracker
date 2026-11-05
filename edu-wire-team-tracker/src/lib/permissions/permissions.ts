import type { PermissionKey, PermissionScope } from '@/features/auth/types/auth.types'

export const PERMISSIONS = {
  TASK_VIEW: 'task.view' as PermissionKey,
  TASK_CREATE: 'task.create' as PermissionKey,
  TASK_EDIT: 'task.edit' as PermissionKey,
  TASK_STATUS: 'task.status' as PermissionKey,
  TASK_DELETE: 'task.delete' as PermissionKey,
  REPORT_VIEW: 'report.view' as PermissionKey,
  USER_MANAGE: 'user.manage' as PermissionKey,
  TEAM_MANAGE: 'team.manage' as PermissionKey,
  BRANCH_MANAGE: 'branch.manage' as PermissionKey,
  ROLE_MANAGE: 'role.manage' as PermissionKey,
} as const

export const SCOPES = {
  OWN: 'own' as PermissionScope,
  TEAM: 'team' as PermissionScope,
  BRANCH: 'branch' as PermissionScope,
  ALL: 'all' as PermissionScope,
} as const

// Scope hierarchy: 'all' covers 'branch', 'team', 'own'. 'branch' covers 'team', 'own'. 'team' covers 'own'.
const SCOPE_HIERARCHY: Record<PermissionScope, number> = {
  own: 1,
  team: 2,
  branch: 3,
  all: 4,
}

export function isScopeSatisfied(
  userScope: PermissionScope | undefined,
  requiredScope: PermissionScope | undefined,
): boolean {
  if (!requiredScope) return true
  if (!userScope) return true // Default unrestricted if not specified on user permission
  const userLevel = SCOPE_HIERARCHY[userScope] ?? 0
  const requiredLevel = SCOPE_HIERARCHY[requiredScope] ?? 0
  return userLevel >= requiredLevel
}

