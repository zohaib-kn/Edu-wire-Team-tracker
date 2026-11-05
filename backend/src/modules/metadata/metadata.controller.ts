import type { Request, Response, NextFunction } from 'express'
import { metadataService } from './metadata.service.js'
import { AppError } from '../../utils/AppError.js'

export const metadataController = {
  /**
   * GET /api/v1/branches
   */
  async getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branches = await metadataService.getBranches(req.user)

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
   * GET /api/v1/teams
   */
  async getTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined
      const teams = await metadataService.getTeams(req.user, branch)

      res.status(200).json({
        success: true,
        teams,
        data: teams,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/v1/teams/:id/members
   */
  async getTeamMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const members = await metadataService.getTeamMembers(id, req.user)

      res.status(200).json({
        success: true,
        members,
        data: members,
      })
    } catch (error) {
      next(error)
    }
  },
}
