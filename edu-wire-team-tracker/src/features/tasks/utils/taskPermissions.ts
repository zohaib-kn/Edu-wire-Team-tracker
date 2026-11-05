import type { User } from '@/features/auth/types/auth.types'
import type { Task } from '../types/task.types'

export type TaskAction = 'view' | 'create' | 'edit' | 'status' | 'delete'

function resolveUserScope(
  user: User,
  requiredPermKey: string,
  action: TaskAction,
): 'all' | 'branch' | 'team' | 'own' {
  if (user.role === 'Super Admin') {
    return 'all'
  }
  if (user.role === 'Branch Admin') {
    return 'branch'
  }
  if (user.role === 'Team Lead') {
    return 'team'
  }

  // Member default or read from explicit permission item
  const explicitItem = user.permissions.find(
    (p) => typeof p === 'object' && p.permission === requiredPermKey,
  )
  if (explicitItem && typeof explicitItem === 'object' && explicitItem.scope) {
    return explicitItem.scope
  }

  return action === 'view' ? 'team' : 'own'
}

/**
 * Checks whether the user is permitted to perform a task action on a specific task
 * using the defined scope rules:
 * - Super Admin: all scope
 * - Branch Admin: branch scope
 * - Team Lead: team scope (no delete)
 * - Member: team view, own create/edit/status (no delete).
 *
 * For 'own' scope: ownership is defined as task owner OR creator.
 */
export function canPerformTaskAction(
  user: User | null | undefined,
  action: TaskAction,
  task?: Task | null,
): boolean {
  if (!user) return false

  // Deletion is strictly prohibited for Team Lead and Member
  if (action === 'delete') {
    if (user.role === 'Team Lead' || user.role === 'Member') {
      return false
    }
  }

  // Check base permission key
  const requiredPermKey = `task.${action}`

  const hasPerm = user.permissions.some((p) => {
    if (typeof p === 'string') {
      return p === '*' || p === requiredPermKey
    }
    return p.permission === '*' || p.permission === requiredPermKey
  })

  if (!hasPerm) return false

  // If no task is provided (e.g. global "Create Task" button check), allow if user has task.create
  if (!task) {
    return true
  }

  const userScope = resolveUserScope(user, requiredPermKey, action)

  // 1. 'all' scope covers all branches and teams
  if (userScope === 'all') {
    return true
  }

  // 2. 'branch' scope checks branch match
  if (userScope === 'branch') {
    if (!user.branchId) return true
    return task.branch === user.branchId || !task.branch
  }

  // 3. 'team' scope checks team match
  if (userScope === 'team') {
    if (action === 'delete') return false
    if (!user.teamId) return true
    return task.team === user.teamId || !task.team
  }

  // 4. 'own' scope: owner OR creator (per implementation specification)
  if (userScope === 'own') {
    if (action === 'delete') return false
    const userId = user.id
    const userName = user.name
    const userEmail = user.email

    const isOwner =
      task.owner === userId ||
      task.owner === userName ||
      task.owner === userEmail

    const isCreator =
      task.createdBy === userId ||
      task.createdBy === userName ||
      task.createdBy === userEmail

    return isOwner || isCreator
  }

  return false
}
