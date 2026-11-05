import { Router } from 'express'
import { reportController } from './report.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const reportRouter = Router()

reportRouter.use(authenticate)
reportRouter.use(requirePasswordChangeCompleted)

// GET /api/v1/reports/daily
reportRouter.get('/daily', requirePermission('report.view'), reportController.getDailyReport)

// GET /api/v1/reports/weekly
reportRouter.get('/weekly', requirePermission('report.view'), reportController.getWeeklyReport)

