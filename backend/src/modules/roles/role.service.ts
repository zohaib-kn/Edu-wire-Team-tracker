import mongoose from 'mongoose'
import { Role, type IRole } from '../../models/Role.js'
import { User } from '../../models/User.js'
import { Activity } from '../../models/Activity.js'
import { AppError } from '../../utils/AppError.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'
import {
  SYSTEM_PERMISSION_KEYS,
  type CreateRoleInput,
  type UpdateRoleInput,
} from './role.schemas.js'

export interface FormattedRolePermission {
  permission: string
  scope: 'none' | 'own' | 'team' | 'branch' | 'all'
}

export interface FormattedRoleItem {
  id: string
  name: string
  description: string
  isSystem: boolean
  permissions: FormattedRolePermission[]
  userCount: number
  updatedAt?: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatRole(role: IRole, userCount = 0): FormattedRoleItem {
  const permMap = new Map<string, 'none' | 'own' | 'team' | 'branch' | 'all'>()
  for (const p of role.permissions) {
    permMap.set(p.key, p.scope)
  }

  // Populate matrix format for all system permission keys
  const permissions: FormattedRolePermission[] = SYSTEM_PERMISSION_KEYS.map((key) => ({
    permission: key,
    scope: permMap.get(key) || 'none',
  }))

  return {
    id: role._id.toString(),
    name: role.name,
    description: role.description || '',
    isSystem: role.isSystem,
    permissions,
    userCount,
    updatedAt: role.updatedAt ? role.updatedAt.toISOString() : undefined,
  }
}

export const roleService = {
  /**
   * Retrieves all roles with permission matrices and user counts.
   */
  async getRoles(): Promise<FormattedRoleItem[]> {
    const roles = await Role.find().sort({ createdAt: 1 }).exec()

    const formatted = await Promise.all(
      roles.map(async (r) => {
        const userCount = await User.countDocuments({ role: r._id, isActive: true }).exec()
        return formatRole(r, userCount)
      }),
    )

    return formatted
  },

  /**
   * Creates a custom role (requires role.manage).
   */
  async createRole(
    input: CreateRoleInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedRoleItem> {
    const existing = await Role.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(input.name)}$`, 'i') },
    }).exec()

    if (existing) {
      throw AppError.conflict(`A role named '${input.name}' already exists`, 'ROLE_ALREADY_EXISTS')
    }

    const validPermissions = input.permissions
      .filter((p) => p.scope !== 'none')
      .map((p) => ({
        key: p.permission,
        scope: p.scope as 'own' | 'team' | 'branch' | 'all',
      }))

    const newRole = await Role.create({
      name: input.name,
      description: input.description || '',
      isSystem: false,
      permissions: validPermissions,
    })

    await Activity.create({
      user: currentUser.id,
      action: 'role_created',
      to: { roleId: newRole._id, name: newRole.name },
      at: new Date(),
    })

    return formatRole(newRole, 0)
  },

  /**
   * Updates an existing role's permissions (requires role.manage).
   */
  async updateRole(
    id: string,
    input: UpdateRoleInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedRoleItem> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid role ID', 'ROLE_NOT_FOUND')
    }

    const role = await Role.findById(id).exec()
    if (!role) {
      throw AppError.notFound('Role not found', 'ROLE_NOT_FOUND')
    }

    // Guardrail: Nobody can modify the permissions of their own currently assigned role
    if (currentUser.role === role.name) {
      throw AppError.forbidden(
        'You cannot modify permissions for your own assigned role.',
        'SELF_ROLE_CHANGE_BLOCKED',
      )
    }

    // Guardrail: Cannot rename system roles
    if (role.isSystem && input.name !== undefined && input.name !== role.name) {
      throw AppError.badRequest('System roles cannot be renamed', 'SYSTEM_ROLE_RENAME_BLOCKED')
    }

    if (input.name !== undefined && input.name !== role.name) {
      const existing = await Role.findOne({
        _id: { $ne: role._id },
        name: { $regex: new RegExp(`^${escapeRegex(input.name)}$`, 'i') },
      } as any).exec()

      if (existing) {
        throw AppError.conflict(
          `A role named '${input.name}' already exists`,
          'ROLE_ALREADY_EXISTS',
        )
      }
      role.name = input.name
    }

    if (input.description !== undefined) {
      role.description = input.description
    }

    // Convert permission matrix
    const newPermissions = input.permissions
      .filter((p) => p.scope !== 'none')
      .map((p) => ({
        key: p.permission,
        scope: p.scope as 'own' | 'team' | 'branch' | 'all',
      }))

    role.permissions = newPermissions as any
    await role.save()

    await Activity.create({
      user: currentUser.id,
      action: 'role_updated',
      to: { roleId: role._id, name: role.name, permissionCount: newPermissions.length },
      at: new Date(),
    })

    const userCount = await User.countDocuments({ role: role._id, isActive: true }).exec()
    return formatRole(role, userCount)
  },
}
