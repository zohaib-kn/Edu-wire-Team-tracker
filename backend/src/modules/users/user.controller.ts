import type { Request, Response, NextFunction } from 'express'
import { userService } from './user.service.js'
import { createUserSchema, updateUserSchema, userQuerySchema } from './user.schemas.js'
import { AppError } from '../../utils/AppError.js'

export const userController = {
  /**
   * GET /api/v1/users
   * List staff accounts
   */
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = userQuerySchema.parse(req.query)
      const result = await userService.getUsers(validated, req.user)

      res.status(200).json({
        success: true,
        data: result.users,
        users: result.users,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/users
   * Create employee account
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = createUserSchema.parse(req.body)
      const user = await userService.createUser(validated, req.user)

      res.status(201).json({
        success: true,
        data: user,
        user,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/users/:id
   * Update staff account details or status
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const validated = updateUserSchema.parse(req.body)
      const user = await userService.updateUser(id, validated, req.user)

      res.status(200).json({
        success: true,
        data: user,
        user,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/users/:id/reset-password
   * Reset temporary password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const result = await userService.resetPassword(id, req.user)

      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },
}

