import type { Request, Response, NextFunction } from 'express'
import { summaryService } from './summary.service.js'
import { AppError } from '../../utils/AppError.js'

export const summaryController = {
  /**
   * GET /api/v1/summary
   * Returns scoped dashboard summary statistics
   */
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined
      const team = typeof req.query.team === 'string' ? req.query.team : undefined

      const summary = await summaryService.getSummary({ branch, team }, req.user)

      res.status(200).json({
        success: true,
        ...summary,
        data: summary,
        summary,
      })
    } catch (error) {
      next(error)
    }
  },
}

