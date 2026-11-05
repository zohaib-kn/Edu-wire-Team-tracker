import type { Request, Response, NextFunction } from 'express'
import { teamService } from './team.service.js'
import { createTeamSchema, updateTeamSchema } from './team.schemas.js'
import { AppError } from '../../utils/AppError.js'

export const teamController = {
  /**
   * GET /api/v1/teams
   */
  async getTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined
      const teams = await teamService.getTeams(req.user, branch)

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
      const members = await teamService.getTeamMembers(id, req.user)

      res.status(200).json({
        success: true,
        members,
        data: members,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/teams
   */
  async createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const validated = createTeamSchema.parse(req.body)
      const team = await teamService.createTeam(validated, req.user)

      res.status(201).json({
        success: true,
        team,
        data: team,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/teams/:id
   */
  async updateTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const validated = updateTeamSchema.parse(req.body)
      const team = await teamService.updateTeam(id, validated, req.user)

      res.status(200).json({
        success: true,
        team,
        data: team,
      })
    } catch (error) {
      next(error)
    }
  },
}

