import mongoose from 'mongoose'
import { User, type IUser } from '../../models/User.js'
import { Role, type IRole } from '../../models/Role.js'
import { Branch, type IBranch } from '../../models/Branch.js'
import { Team, type ITeam } from '../../models/Team.js'
import { Session } from '../../models/Session.js'
import { Activity } from '../../models/Activity.js'
import { passwordService } from '../../services/password.service.js'
import { AppError } from '../../utils/AppError.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'
import type { CreateUserInput, UpdateUserInput, UserQueryInput } from './user.schemas.js'

export interface FormattedManagedUser {
  id: string
  name: string
  email: string
  phone: string
  role: string
  roleId: string
  branch: string
  branchId: string
  teams: string[]
  teamIds: string[]
  status: 'active' | 'inactive' | 'locked'
  isActive: boolean
  lastLogin: string | null
  createdAt?: string
  updatedAt?: string
  temporaryPassword?: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let randomPart = ''
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `Temp@${randomPart}1`
}

function formatUser(user: IUser, temporaryPassword?: string): FormattedManagedUser {
  const roleDoc = user.role as unknown as IRole
  const branchDoc = user.branch as unknown as IBranch
  const teamDocs = (user.teams || []) as unknown as ITeam[]

  const roleName = roleDoc && typeof roleDoc === 'object' && 'name' in roleDoc
    ? roleDoc.name
    : 'Member'
  const roleId = roleDoc && typeof roleDoc === 'object' && '_id' in roleDoc
    ? roleDoc._id.toString()
    : (user.role ? user.role.toString() : '')

  const branchName = branchDoc && typeof branchDoc === 'object' && 'name' in branchDoc
    ? branchDoc.name
    : 'Headquarters / All'
  const branchId = branchDoc && typeof branchDoc === 'object' && '_id' in branchDoc
    ? branchDoc._id.toString()
    : (user.branch ? user.branch.toString() : '')

  const teamNames = teamDocs.map((t: any) => (t && typeof t === 'object' && 'name' in t ? t.name : String(t)))
  const teamIds = teamDocs.map((t: any) => (t && typeof t === 'object' && '_id' in t ? t._id.toString() : String(t)))

  let status: 'active' | 'inactive' | 'locked' = 'active'
  if (!user.isActive) {
    status = 'inactive'
  } else if (user.lockedUntil && user.lockedUntil > new Date()) {
    status = 'locked'
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: roleName,
    roleId,
    branch: branchName,
    branchId,
    teams: teamNames,
    teamIds,
    status,
    isActive: user.isActive,
    lastLogin: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt ? user.createdAt.toISOString() : undefined,
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : undefined,
    temporaryPassword,
  }
}

export const userService = {
  /**
   * Retrieves a paginated list of staff accounts according to user management authorization.
   */
  async getUsers(
    query: UserQueryInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<{ users: FormattedManagedUser[]; total: number; page: number; limit: number; totalPages: number }> {
    const filter: Record<string, any> = {}

    // Organizational scope enforcement:
    // Branch Admin can only view accounts within their assigned branch
    if (currentUser.role !== 'Super Admin') {
      if (!currentUser.branchId) {
        return { users: [], total: 0, page: 1, limit: query.limit, totalPages: 1 }
      }
      filter.branch = currentUser.branchId
    } else if (query.branch && query.branch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(query.branch)) {
        filter.branch = query.branch
      } else {
        const b = await Branch.findOne({ name: query.branch }).exec()
        if (b) filter.branch = b._id
      }
    }

    // Role filter
    if (query.role && query.role !== 'all') {
      if (mongoose.Types.ObjectId.isValid(query.role)) {
        filter.role = query.role
      } else {
        const r = await Role.findOne({ name: query.role }).exec()
        if (r) filter.role = r._id
      }
    }

    // Status filter
    if (query.status && query.status !== 'all') {
      if (query.status === 'active') {
        filter.isActive = true
        filter.$or = [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }]
      } else if (query.status === 'inactive') {
        filter.isActive = false
      } else if (query.status === 'locked') {
        filter.lockedUntil = { $gt: new Date() }
      }
    }

    // Search query q (name, email, phone)
    if (query.q && query.q.trim()) {
      const escaped = escapeRegex(query.q.trim())
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ]
    }

    const page = query.page || 1
    const limit = query.limit || 50
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('role')
        .populate('branch')
        .populate('teams')
        .exec(),
      User.countDocuments(filter).exec(),
    ])

    return {
      users: users.map((u) => formatUser(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  },

  /**
   * Creates an employee account with branch/team validation and temporary credentials.
   */
  async createUser(
    input: CreateUserInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedManagedUser> {
    // 1. Resolve Branch
    let branchDoc: (IBranch & { _id: mongoose.Types.ObjectId }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.branch)) {
      branchDoc = (await Branch.findById(input.branch).exec()) as any
    }
    if (!branchDoc) {
      branchDoc = (await Branch.findOne({ name: input.branch }).exec()) as any
    }
    if (!branchDoc || !branchDoc.isActive) {
      throw AppError.badRequest('Selected branch does not exist or is inactive', 'BRANCH_NOT_FOUND')
    }

    // Branch Admin boundary check
    if (currentUser.role !== 'Super Admin') {
      if (!currentUser.branchId || currentUser.branchId !== branchDoc._id.toString()) {
        throw AppError.forbidden(
          'Branch Admins can only create accounts within their assigned branch',
          'INSUFFICIENT_SCOPE',
        )
      }
    }

    // 2. Resolve Role
    let roleDoc: (IRole & { _id: mongoose.Types.ObjectId }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.role)) {
      roleDoc = (await Role.findById(input.role).exec()) as any
    }
    if (!roleDoc) {
      roleDoc = (await Role.findOne({ name: input.role }).exec()) as any
    }
    if (!roleDoc) {
      throw AppError.badRequest('Selected role does not exist', 'ROLE_NOT_FOUND')
    }

    // Branch Admin privilege escalation check
    if (currentUser.role !== 'Super Admin') {
      if (roleDoc.name === 'Super Admin' || roleDoc.name === 'Branch Admin') {
        throw AppError.forbidden(
          'Branch Admins can only create Team Lead or Member accounts.',
          'INSUFFICIENT_SCOPE',
        )
      }
    }

    // 3. Resolve & Validate Teams
    const teamObjectIds: mongoose.Types.ObjectId[] = []
    if (input.teams && input.teams.length > 0) {
      for (const teamItem of input.teams) {
        let teamDoc: (ITeam & { _id: mongoose.Types.ObjectId }) | null = null
        if (mongoose.Types.ObjectId.isValid(teamItem)) {
          teamDoc = (await Team.findById(teamItem).exec()) as any
        }
        if (!teamDoc) {
          teamDoc = (await Team.findOne({ name: teamItem }).exec()) as any
        }
        if (!teamDoc || !teamDoc.isActive) {
          throw AppError.badRequest(
            `Assigned team '${teamItem}' does not exist or is inactive`,
            'TEAM_NOT_FOUND',
          )
        }

        // Team must belong to the user's branch
        if (teamDoc.branch.toString() !== branchDoc._id.toString()) {
          throw AppError.badRequest(
            `Team '${teamDoc.name}' does not belong to branch '${branchDoc.name}'`,
            'INVALID_BRANCH_TEAM',
          )
        }

        teamObjectIds.push(teamDoc._id)
      }
    }

    // 4. Duplicate Email check
    const existingEmail = await User.findOne({ email: input.email }).exec()
    if (existingEmail) {
      throw AppError.conflict(
        `An account with email '${input.email}' already exists.`,
        'EMAIL_ALREADY_EXISTS',
      )
    }

    // 5. Temporary password generation & hashing
    const tempPassword = input.temporaryPassword || generateTemporaryPassword()
    const passwordHash = await passwordService.hashPassword(tempPassword)

    // 6. Create User
    const newUser = await User.create({
      name: input.name,
      email: input.email,
      phone: input.phone || '',
      role: roleDoc._id,
      branch: branchDoc._id,
      teams: teamObjectIds,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    })

    // 7. Audit log
    await Activity.create({
      user: currentUser.id,
      action: 'user_created',
      to: {
        userId: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: roleDoc.name,
        branch: branchDoc.name,
      },
      at: new Date(),
    })

    // 8. Populate & return
    const populated = await User.findById(newUser._id)
      .populate('role')
      .populate('branch')
      .populate('teams')
      .exec()

    return formatUser(populated!, tempPassword)
  },

  /**
   * Updates an existing staff account with organizational and role guardrails.
   */
  async updateUser(
    id: string,
    input: UpdateUserInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedManagedUser> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid user ID', 'USER_NOT_FOUND')
    }

    const targetUser = await User.findById(id)
      .populate<{ role: IRole }>('role')
      .populate<{ branch: IBranch }>('branch')
      .exec()

    if (!targetUser) {
      throw AppError.notFound('Staff user not found', 'USER_NOT_FOUND')
    }

    const currentRoleName = targetUser.role && typeof targetUser.role === 'object' && 'name' in targetUser.role
      ? (targetUser.role as IRole).name
      : ''

    // Guardrail 1: Nobody can modify their own role
    if (currentUser.id === targetUser._id.toString() && input.role !== undefined) {
      throw AppError.forbidden('You cannot modify your own assigned role.', 'SELF_ROLE_CHANGE_BLOCKED')
    }

    // Guardrail 2: Branch Admin scope boundary
    if (currentUser.role !== 'Super Admin') {
      if (
        !currentUser.branchId ||
        (targetUser.branch && targetUser.branch._id.toString() !== currentUser.branchId)
      ) {
        throw AppError.forbidden('Cannot manage accounts outside your assigned branch.', 'FORBIDDEN')
      }

      // Branch Admin cannot edit Super Admin or another Branch Admin
      if (currentRoleName === 'Super Admin' || currentRoleName === 'Branch Admin') {
        throw AppError.forbidden(
          'Branch Admins cannot modify Super Admin or Branch Admin accounts.',
          'INSUFFICIENT_SCOPE',
        )
      }
    }

    // Guardrail 3: Protect the last active Super Admin
    if (currentRoleName === 'Super Admin') {
      const isDeactivating = input.isActive === false || input.status === 'inactive'
      const isChangingRole = input.role !== undefined

      if (isDeactivating || isChangingRole) {
        const superAdminRole = await Role.findOne({ name: 'Super Admin' }).exec()
        if (superAdminRole) {
          const activeSuperAdminCount = await User.countDocuments({
            role: superAdminRole._id,
            isActive: true,
          }).exec()

          if (activeSuperAdminCount <= 1) {
            throw AppError.badRequest(
              'The last active Super Admin account cannot be deactivated or demoted.',
              'LAST_SUPER_ADMIN_PROTECTED',
            )
          }
        }
      }
    }

    // Apply updates
    if (input.name !== undefined) targetUser.name = input.name
    if (input.phone !== undefined) targetUser.phone = input.phone

    // Role update
    if (input.role !== undefined) {
      let roleDoc: (IRole & { _id: mongoose.Types.ObjectId }) | null = null
      if (mongoose.Types.ObjectId.isValid(input.role)) {
        roleDoc = (await Role.findById(input.role).exec()) as any
      }
      if (!roleDoc) {
        roleDoc = (await Role.findOne({ name: input.role }).exec()) as any
      }
      if (!roleDoc) {
        throw AppError.badRequest('Selected role does not exist', 'ROLE_NOT_FOUND')
      }

      // Branch Admin cannot promote to Super Admin or Branch Admin
      if (currentUser.role !== 'Super Admin') {
        if (roleDoc.name === 'Super Admin' || roleDoc.name === 'Branch Admin') {
          throw AppError.forbidden(
            'Branch Admins cannot promote users to administrator roles.',
            'INSUFFICIENT_SCOPE',
          )
        }
      }

      targetUser.role = roleDoc._id as any
    }

    // Branch update
    let targetBranchId = targetUser.branch ? (targetUser.branch._id ? targetUser.branch._id.toString() : targetUser.branch.toString()) : null
    if (input.branch !== undefined) {
      let branchDoc: (IBranch & { _id: mongoose.Types.ObjectId }) | null = null
      if (mongoose.Types.ObjectId.isValid(input.branch)) {
        branchDoc = (await Branch.findById(input.branch).exec()) as any
      }
      if (!branchDoc) {
        branchDoc = (await Branch.findOne({ name: input.branch }).exec()) as any
      }
      if (!branchDoc || !branchDoc.isActive) {
        throw AppError.badRequest('Selected branch does not exist or is inactive', 'BRANCH_NOT_FOUND')
      }

      // Branch Admin boundary
      if (currentUser.role !== 'Super Admin' && currentUser.branchId !== branchDoc._id.toString()) {
        throw AppError.forbidden('Branch Admins cannot move users across branches.', 'INSUFFICIENT_SCOPE')
      }

      targetUser.branch = branchDoc._id as any
      targetBranchId = branchDoc._id.toString()
    }

    // Teams update
    if (input.teams !== undefined) {
      const newTeamIds: mongoose.Types.ObjectId[] = []
      for (const teamItem of input.teams) {
        let teamDoc: (ITeam & { _id: mongoose.Types.ObjectId }) | null = null
        if (mongoose.Types.ObjectId.isValid(teamItem)) {
          teamDoc = (await Team.findById(teamItem).exec()) as any
        }
        if (!teamDoc) {
          teamDoc = (await Team.findOne({ name: teamItem }).exec()) as any
        }
        if (!teamDoc || !teamDoc.isActive) {
          throw AppError.badRequest(
            `Assigned team '${teamItem}' does not exist or is inactive`,
            'TEAM_NOT_FOUND',
          )
        }

        // Validate team belongs to user's branch
        if (targetBranchId && teamDoc.branch.toString() !== targetBranchId) {
          throw AppError.badRequest(
            `Assigned team '${teamDoc.name}' does not belong to the user's branch`,
            'INVALID_BRANCH_TEAM',
          )
        }

        newTeamIds.push(teamDoc._id)
      }
      targetUser.teams = newTeamIds
    }

    // Status / Deactivation toggle
    const shouldDeactivate = input.isActive === false || input.status === 'inactive'
    const shouldActivate = input.isActive === true || input.status === 'active'

    if (shouldDeactivate) {
      targetUser.isActive = false
      // Revoke all active sessions upon deactivation
      await Session.deleteMany({ user: targetUser._id }).exec()

      await Activity.create({
        user: currentUser.id,
        action: 'user_deactivated',
        to: { userId: targetUser._id, name: targetUser.name },
        at: new Date(),
      })
    } else if (shouldActivate) {
      targetUser.isActive = true
      targetUser.lockedUntil = null
      targetUser.failedLogins = 0
    }

    await targetUser.save()

    await Activity.create({
      user: currentUser.id,
      action: 'user_updated',
      to: { userId: targetUser._id, name: targetUser.name },
      at: new Date(),
    })

    const populated = await User.findById(targetUser._id)
      .populate('role')
      .populate('branch')
      .populate('teams')
      .exec()

    return formatUser(populated!)
  },

  /**
   * Resets an employee's password, sets mustChangePassword=true, and revokes active sessions.
   */
  async resetPassword(
    id: string,
    currentUser: AuthenticatedUserContext,
  ): Promise<{ success: boolean; message: string; temporaryPassword: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid user ID', 'USER_NOT_FOUND')
    }

    const targetUser = await User.findById(id).populate<{ role: IRole }>('role').exec()
    if (!targetUser) {
      throw AppError.notFound('Staff user not found', 'USER_NOT_FOUND')
    }

    // Branch Admin boundary check
    if (currentUser.role !== 'Super Admin') {
      if (!currentUser.branchId || targetUser.branch?.toString() !== currentUser.branchId) {
        throw AppError.forbidden('Cannot reset password for staff outside your branch', 'FORBIDDEN')
      }

      const targetRole = targetUser.role && typeof targetUser.role === 'object' && 'name' in targetUser.role
        ? (targetUser.role as IRole).name
        : ''

      if (targetRole === 'Super Admin' || targetRole === 'Branch Admin') {
        throw AppError.forbidden('Branch Admins cannot reset passwords for administrators', 'INSUFFICIENT_SCOPE')
      }
    }

    const temporaryPassword = generateTemporaryPassword()
    targetUser.passwordHash = await passwordService.hashPassword(temporaryPassword)
    targetUser.mustChangePassword = false
    targetUser.lockedUntil = null
    targetUser.failedLogins = 0
    await targetUser.save()

    // Revoke all active sessions
    await Session.deleteMany({ user: targetUser._id }).exec()

    await Activity.create({
      user: currentUser.id,
      action: 'password_reset',
      to: { userId: targetUser._id, name: targetUser.name },
      at: new Date(),
    })

    return {
      success: true,
      message: 'Password reset successfully. A new password has been issued.',
      temporaryPassword,
    }
  },
}
