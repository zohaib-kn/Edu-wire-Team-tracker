import type { Types } from 'mongoose'
import type { AuthenticatedUserContext } from '../types/auth.types.js'
import type { PermissionScope } from '../models/Role.js'

export interface TaskResourceContext {
  teamId?: string | Types.ObjectId | unknown
  branchId?: string | Types.ObjectId | unknown
  ownerId?: string | Types.ObjectId | unknown
  createdById?: string | Types.ObjectId | unknown
  reportingManagerId?: string | Types.ObjectId | unknown
  subtaskOwnerIds?: (string | Types.ObjectId | unknown)[]
}

function extractId(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && '_id' in (val as Record<string, unknown>)) {
    return ((val as Record<string, unknown>)._id as string | Types.ObjectId).toString()
  }
  return String(val)
}

export const permissionsService = {
  /**
   * Evaluates if a user has permission to perform an action on a specific resource context.
   */
  can(
    user: AuthenticatedUserContext,
    permissionKey: string,
    resource?: TaskResourceContext,
  ): boolean {
    // Super Admin has universal authorization
    if (user.role === 'Super Admin') {
      return true
    }

    const permission = user.permissions.find((p) => p.key === permissionKey)
    if (!permission) {
      return false
    }

    // If no specific resource context is provided, presence of permission key is sufficient
    if (!resource) {
      return true
    }

    // Delegated narrow read access: A designated reporting manager can view their supervised task
    if (permissionKey === 'task.view' && resource.reportingManagerId) {
      const reportingManagerId = extractId(resource.reportingManagerId)
      if (reportingManagerId && reportingManagerId === user.id.toString()) {
        return true
      }
    }

    // Delegated narrow read access: An assigned subtask owner can view the parent task
    if (permissionKey === 'task.view' && resource.subtaskOwnerIds && Array.isArray(resource.subtaskOwnerIds)) {
      const isSubOwner = resource.subtaskOwnerIds.some((sId) => extractId(sId) === user.id.toString())
      if (isSubOwner) {
        return true
      }
    }

    const scope: PermissionScope = permission.scope || 'own'

    switch (scope) {
      case 'all':
        return true

      case 'branch': {
        const resourceBranchId = extractId(resource.branchId)
        if (!user.branchId || !resourceBranchId) return false
        return user.branchId.toString() === resourceBranchId
      }

      case 'team': {
        const resourceTeamId = extractId(resource.teamId)
        if (!resourceTeamId || !user.teams) return false
        return user.teams.some((t) => t.toString() === resourceTeamId)
      }

      case 'own': {
        const userId = user.id.toString()
        const resourceOwnerId = extractId(resource.ownerId)
        const resourceCreatedById = extractId(resource.createdById)
        const isOwner = resourceOwnerId === userId
        const isCreator = resourceCreatedById === userId
        return isOwner || isCreator
      }

      default:
        return false
    }
  },

  /**
   * Generates a MongoDB query constraint representing the user's authorized scope boundary.
   * Returns null if the user lacks the required permission entirely.
   */
  getScopeFilter(
    user: AuthenticatedUserContext,
    permissionKey: string,
  ): Record<string, unknown> | null {
    if (user.role === 'Super Admin') {
      return {}
    }

    const permission = user.permissions.find((p) => p.key === permissionKey)
    if (!permission) {
      return null
    }

    const scope: PermissionScope = permission.scope || 'own'

    switch (scope) {
      case 'all':
        return {}

      case 'branch': {
        if (!user.branchId) return { _id: { $exists: false } } // Deny all if no branch assigned
        return { branch: user.branchId }
      }

      case 'team': {
        if (!user.teams || user.teams.length === 0) return { _id: { $exists: false } }
        return { team: { $in: user.teams } }
      }

      case 'own': {
        return {
          $or: [
            { owner: user.id },
            { createdBy: user.id },
          ],
        }
      }

      default:
        return { _id: { $exists: false } }
    }
  },

  /**
   * Checks whether the user is an authorized participant in a task discussion.
   * Authorized participants:
   * 1. Super Admin: universal authorized scope.
   * 2. Branch Admin: tasks within their authorized branch.
   * 3. Team Lead: tasks within their authorized team scope.
   * 4. Task Owner: assigned owner of this specific task.
   * 5. Reporting Manager: explicitly designated reporting manager for this task.
   *
   * Note: Creators do not automatically receive lifetime discussion access unless
   * they fulfill one of the explicit participant roles above.
   * Does not expand task.edit or task.delete privileges.
   */
  canAccessTaskDiscussion(
    user: AuthenticatedUserContext,
    resource:
      | TaskResourceContext
      | {
          team?: unknown
          branch?: unknown
          owner?: unknown
          reportingManager?: unknown
          createdBy?: unknown
          teamId?: unknown
          branchId?: unknown
          ownerId?: unknown
          reportingManagerId?: unknown
        },
  ): boolean {
    if (!user) return false

    // 1. Super Admin has universal authorized access
    if (user.role === 'Super Admin') {
      return true
    }

    const userId = user.id.toString()
    const res = resource as Record<string, unknown>
    const ownerId = extractId(res.owner ?? res.ownerId)
    const reportingManagerId = extractId(res.reportingManager ?? res.reportingManagerId)
    const branchId = extractId(res.branch ?? res.branchId)
    const teamId = extractId(res.team ?? res.teamId)

    // 2. Task Owner
    if (ownerId && ownerId === userId) {
      return true
    }

    // 3. Reporting Manager (delegated supervisory access explicitly for this task)
    if (reportingManagerId && reportingManagerId === userId) {
      return true
    }

    // 4. Subtask Owner participating in Parent Task discussion
    if (res.subtaskOwnerIds && Array.isArray(res.subtaskOwnerIds)) {
      const isSubOwner = res.subtaskOwnerIds.some((sId) => extractId(sId) === userId)
      if (isSubOwner) {
        return true
      }
    }

    // 4. Branch Admin: tasks within authorized branch
    if (user.role === 'Branch Admin') {
      const userBranchId = user.branchId ? user.branchId.toString() : null
      if (userBranchId && branchId && userBranchId === branchId) {
        return true
      }
    }

    // 5. Team Lead: tasks within authorized team scope
    if (user.role === 'Team Lead') {
      const userTeams = user.teams || []
      if (teamId && userTeams.some((t) => t.toString() === teamId)) {
        const userBranchId = user.branchId ? user.branchId.toString() : null
        if (!userBranchId || !branchId || userBranchId === branchId) {
          return true
        }
      }
    }

    return false
  },
}
