import { Router } from 'express'
import { branchController } from './branch.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const branchRouter = Router()

branchRouter.use(authenticate)
branchRouter.use(requirePasswordChangeCompleted)

// GET /api/v1/branches - Read-only branch list accessible for filtering & organization view
branchRouter.get('/', branchController.getBranches)

// POST /api/v1/branches - Restricted to branch.manage
branchRouter.post('/', requirePermission('branch.manage'), branchController.createBranch)

// PATCH /api/v1/branches/:id - Restricted to branch.manage
branchRouter.patch('/:id', requirePermission('branch.manage'), branchController.updateBranch)

