import type { Request, Response, NextFunction } from 'express'
import { roleService } from './role.service.js'
import { createRoleSchema, updateRoleSchema } from './role.schemas.js'
import { AppError } from '../../utils/AppError.js'

export const roleController = {
  /**
   * GET /api/v1/roles
   */
  async getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const roles = await roleService.getRoles()

      res.status(200).json({
        success: true,
        roles,
        data: roles,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/roles
   */
  async createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = createRoleSchema.parse(req.body)
      const role = await roleService.createRole(validated, req.user)

      res.status(201).json({
        success: true,
        role,
        data: role,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/roles/:id
   */
  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const validated = updateRoleSchema.parse(req.body)
      const role = await roleService.updateRole(id, validated, req.user)

      res.status(200).json({
        success: true,
        role,
        data: role,
      })
    } catch (error) {
      next(error)
    }
  },
}

