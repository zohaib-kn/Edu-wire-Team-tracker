import type { Request, Response, NextFunction } from 'express'
import { branchService } from './branch.service.js'
import { createBranchSchema, updateBranchSchema } from './branch.schemas.js'
import { AppError } from '../../utils/AppError.js'

export const branchController = {
  /**
   * GET /api/v1/branches
   */
  async getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branches = await branchService.getBranches(req.user)

      res.status(200).json({
        success: true,
        branches,
        data: branches,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/branches
   */
  async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = createBranchSchema.parse(req.body)
      const branch = await branchService.createBranch(validated, req.user)

      res.status(201).json({
        success: true,
        branch,
        data: branch,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/branches/:id
   */
  async updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const validated = updateBranchSchema.parse(req.body)
      const branch = await branchService.updateBranch(id, validated, req.user)

      res.status(200).json({
        success: true,
        branch,
        data: branch,
      })
    } catch (error) {
      next(error)
    }
  },
}

