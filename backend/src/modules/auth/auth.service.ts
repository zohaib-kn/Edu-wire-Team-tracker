import { User, type IUser } from '../../models/User.js'
import { Role, type IRole } from '../../models/Role.js'
import { Session } from '../../models/Session.js'
import { passwordService } from '../../services/password.service.js'
import {
  tokenService,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '../../services/token.service.js'
import { AppError } from '../../utils/AppError.js'
import type { LoginInput, ChangePasswordInput } from './auth.schemas.js'

export interface FormattedUserResponse {
  id: string
  name: string
  email: string
  role: string
  branchId: string | null
  teamId: string | null
  teams: string[]
  mustChangePassword: boolean
  status: string
  permissions: Array<string | { permission: string; scope: string }>
  lastLoginAt?: Date | null
  createdAt?: Date
}

function formatUser(user: IUser, roleDoc?: IRole): FormattedUserResponse {
  const roleName = roleDoc ? roleDoc.name : 'Member'
  const rawPermissions = roleDoc && Array.isArray(roleDoc.permissions) ? roleDoc.permissions : []

  // Create both structured entries and plain strings so all frontend permission helpers match
  const permissions: Array<string | { permission: string; scope: string }> = []
  for (const p of rawPermissions) {
    permissions.push({ permission: p.key, scope: p.scope })
    permissions.push(p.key) // Allows direct string checks like can('task.view')
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: roleName,
    branchId: user.branch ? user.branch.toString() : null,
    teamId: user.teams && user.teams.length > 0 ? user.teams[0].toString() : null,
    teams: (user.teams || []).map((t) => t.toString()),
    mustChangePassword: Boolean(user.mustChangePassword),
    status: user.isActive ? 'active' : 'inactive',
    permissions,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

export const authService = {
  /**
   * Validates credentials, manages failed login tracking and locks,
   * and issues fresh JWT access and refresh token session.
   */
  async login(
    input: LoginInput,
    device = 'Web Browser',
  ): Promise<{ accessToken: string; refreshToken: string; user: FormattedUserResponse }> {
    const normalizedEmail = input.email.trim().toLowerCase()

    // Query user including passwordHash
    const user = await User.findOne({ email: normalizedEmail })
      .select('+passwordHash')
      .populate<{ role: IRole }>('role')
      .exec()

    if (!user) {
      // Generic error prevents email enumeration
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // Check if account is temporarily locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000),
      )
      throw AppError.forbidden(
        `Account is temporarily locked due to 5 consecutive failed login attempts. Try again in ${remainingMinutes} minute(s).`,
        'ACCOUNT_LOCKED',
      )
    }

    // Check if account is active
    if (!user.isActive) {
      throw AppError.forbidden(
        'Your account has been deactivated. Please contact your administrator.',
        'ACCOUNT_INACTIVE',
      )
    }

    // Verify password with bcrypt
    const isPasswordValid = await passwordService.comparePassword(
      input.password,
      user.passwordHash,
    )

    if (!isPasswordValid) {
      user.failedLogins = (user.failedLogins || 0) + 1

      if (user.failedLogins >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000) // 15-minute lock
        user.failedLogins = 0
        await user.save()
        throw AppError.forbidden(
          'Account temporarily locked for 15 minutes due to 5 consecutive failed login attempts.',
          'ACCOUNT_LOCKED',
        )
      }

      await user.save()
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // Reset failed login counter upon successful authentication
    user.failedLogins = 0
    user.lockedUntil = null
    user.lastLoginAt = new Date()
    await user.save()

    const roleDoc = user.role as unknown as IRole
    const roleName = roleDoc ? roleDoc.name : 'Member'

    // Generate JWT access token
    const accessToken = tokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: roleName,
    })

    // Generate and store cryptographically secure refresh token
    const refreshToken = tokenService.generateRefreshToken()
    const refreshTokenHash = tokenService.hashRefreshToken(refreshToken)
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    )

    await Session.create({
      user: user._id,
      refreshTokenHash,
      device,
      expiresAt,
    })

    return {
      accessToken,
      refreshToken,
      user: formatUser(user, roleDoc),
    }
  },

  /**
   * Validates refresh token from cookie, performs atomic token rotation,
   * and returns a fresh access token and updated user profile.
   */
  async refresh(
    refreshToken: string,
    device = 'Web Browser',
  ): Promise<{ accessToken: string; newRefreshToken: string; user: FormattedUserResponse }> {
    if (!refreshToken) {
      throw AppError.unauthorized('Refresh token is required', 'TOKEN_MISSING')
    }

    const refreshTokenHash = tokenService.hashRefreshToken(refreshToken)

    // Lookup session by hashed token
    const session = await Session.findOne({ refreshTokenHash })

    if (!session) {
      // Possible reused or revoked token - fail cleanly
      throw AppError.unauthorized(
        'Invalid or revoked refresh session. Please sign in again.',
        'SESSION_REVOKED',
      )
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      await Session.deleteOne({ _id: session._id })
      throw AppError.unauthorized(
        'Session has expired. Please sign in again.',
        'SESSION_EXPIRED',
      )
    }

    // Load active user
    const user = await User.findById(session.user)
      .populate<{ role: IRole }>('role')
      .exec()

    if (!user || !user.isActive) {
      await Session.deleteOne({ _id: session._id })
      throw AppError.unauthorized(
        'User account is invalid or inactive',
        'ACCOUNT_INACTIVE',
      )
    }

    const roleDoc = user.role as unknown as IRole
    const roleName = roleDoc ? roleDoc.name : 'Member'

    // Concurrency-safe rotation: rotate token hash and renew expiry
    const newRefreshToken = tokenService.generateRefreshToken()
    const newHash = tokenService.hashRefreshToken(newRefreshToken)
    const newExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    )

    session.refreshTokenHash = newHash
    session.expiresAt = newExpiresAt
    if (device) session.device = device
    await session.save()

    const accessToken = tokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: roleName,
    })

    return {
      accessToken,
      newRefreshToken,
      user: formatUser(user, roleDoc),
    }
  },

  /**
   * Retrieves profile and resolved permissions of current authenticated user.
   */
  async getMe(userId: string): Promise<FormattedUserResponse> {
    const user = await User.findById(userId)
      .populate<{ role: IRole }>('role')
      .exec()

    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND')
    }

    return formatUser(user, user.role as unknown as IRole)
  },

  /**
   * Revokes current session or all active sessions for user.
   */
  async logout(
    userId: string,
    currentRefreshToken?: string,
    logoutAll = false,
  ): Promise<void> {
    if (logoutAll) {
      await Session.deleteMany({ user: userId })
      return
    }

    if (currentRefreshToken) {
      const hash = tokenService.hashRefreshToken(currentRefreshToken)
      await Session.deleteOne({ refreshTokenHash: hash })
    }
  },

  /**
   * Validates current password, enforces strength rules, updates hash,
   * sets mustChangePassword to false, and issues fresh credentials.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    device = 'Web Browser',
  ): Promise<{
    success: boolean
    user: FormattedUserResponse
    newAccessToken: string
    newRefreshToken: string
  }> {
    const user = await User.findById(userId)
      .select('+passwordHash')
      .populate<{ role: IRole }>('role')
      .exec()

    if (!user) {
      throw AppError.notFound('User account not found', 'USER_NOT_FOUND')
    }

    const isMatch = await passwordService.comparePassword(
      input.currentPassword,
      user.passwordHash,
    )

    if (!isMatch) {
      throw AppError.badRequest(
        'Incorrect current password. Please verify and try again.',
        'INVALID_CURRENT_PASSWORD',
      )
    }

    // Validate strength
    const strengthCheck = passwordService.validatePasswordStrength(input.newPassword)
    if (!strengthCheck.isValid) {
      throw AppError.badRequest(strengthCheck.message || 'Password does not meet strength requirements')
    }

    // Hash with bcrypt cost 12
    user.passwordHash = await passwordService.hashPassword(input.newPassword)
    user.mustChangePassword = false
    await user.save()

    // Invalidate old sessions to prevent use of stale credentials
    await Session.deleteMany({ user: user._id })

    const roleDoc = user.role as unknown as IRole
    const roleName = roleDoc ? roleDoc.name : 'Member'

    // Issue new session
    const newAccessToken = tokenService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: roleName,
    })

    const newRefreshToken = tokenService.generateRefreshToken()
    const refreshTokenHash = tokenService.hashRefreshToken(newRefreshToken)
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    )

    await Session.create({
      user: user._id,
      refreshTokenHash,
      device,
      expiresAt,
    })

    return {
      success: true,
      user: formatUser(user, roleDoc),
      newAccessToken,
      newRefreshToken,
    }
  },
}

