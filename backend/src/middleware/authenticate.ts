import type { Request, Response, NextFunction } from 'express'
import { tokenService } from '../services/token.service.js'
import { User, type IUser } from '../models/User.js'
import type { IRole } from '../models/Role.js'
import { AppError } from '../utils/AppError.js'
import type { AuthenticatedUserContext } from '../types/auth.types.js'

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token missing or malformed', 'TOKEN_MISSING')
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      throw AppError.unauthorized('Authentication token missing', 'TOKEN_MISSING')
    }

    let payload
    try {
      payload = tokenService.verifyAccessToken(token)
    } catch (err) {
      const errorMsg = (err as Error).name === 'TokenExpiredError' ? 'Session expired. Please refresh your token.' : 'Invalid authentication token'
      const errorCode = (err as Error).name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
      throw AppError.unauthorized(errorMsg, errorCode)
    }

    // Load active user from MongoDB with populated role
    const user = await User.findById(payload.userId)
      .populate<{ role: IRole }>('role')
      .exec()

    if (!user) {
      throw AppError.unauthorized('User account not found', 'USER_NOT_FOUND')
    }

    if (!user.isActive) {
      throw AppError.forbidden('Your account has been deactivated. Please contact your administrator.', 'ACCOUNT_INACTIVE')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000))
      throw AppError.forbidden(`Account temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minute(s).`, 'ACCOUNT_LOCKED')
    }

    const roleDoc = user.role as unknown as IRole
    const roleName = roleDoc ? roleDoc.name : 'Member'
    const permissions = roleDoc && Array.isArray(roleDoc.permissions) ? roleDoc.permissions : []

    const userContext: AuthenticatedUserContext = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roleName,
      branchId: user.branch ? user.branch.toString() : null,
      teamId: user.teams && user.teams.length > 0 ? user.teams[0].toString() : null,
      teams: (user.teams || []).map((t) => t.toString()),
      mustChangePassword: user.mustChangePassword,
      status: user.isActive ? 'active' : 'inactive',
      permissions,
      rawUser: user as IUser,
    }

    req.user = userContext
    next()
  } catch (error) {
    next(error)
  }
}

