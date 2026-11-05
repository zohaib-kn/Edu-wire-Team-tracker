import { Router } from 'express'
import { summaryController } from './summary.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const summaryRouter = Router()

summaryRouter.use(authenticate)
summaryRouter.use(requirePasswordChangeCompleted)

// GET /api/v1/summary
summaryRouter.get('/', requirePermission('task.view'), summaryController.getSummary)

