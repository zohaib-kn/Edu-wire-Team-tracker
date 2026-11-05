import type { Request, Response, NextFunction } from 'express'
import { reportService } from './report.service.js'
import { AppError } from '../../utils/AppError.js'

export const reportController = {
  /**
   * GET /api/v1/reports/daily
   */
  async getDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined
      const team = typeof req.query.team === 'string' ? req.query.team : undefined

      const result = await reportService.getDailyReport({ branch, team }, req.user)

      res.status(200).json({
        success: true,
        ...result,
        data: result,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/v1/reports/weekly
   */
  async getWeeklyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined
      const team = typeof req.query.team === 'string' ? req.query.team : undefined

      const result = await reportService.getWeeklyReport({ branch, team }, req.user)

      res.status(200).json({
        success: true,
        ...result,
        data: result,
      })
    } catch (error) {
      next(error)
    }
  },
}

