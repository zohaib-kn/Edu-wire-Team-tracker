import { Router } from 'express'
import { roleController } from './role.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const roleRouter = Router()

roleRouter.use(authenticate)
roleRouter.use(requirePasswordChangeCompleted)

// GET /api/v1/roles
roleRouter.get('/', requirePermission('role.manage'), roleController.getRoles)

// POST /api/v1/roles
roleRouter.post('/', requirePermission('role.manage'), roleController.createRole)

// PATCH /api/v1/roles/:id
roleRouter.patch('/:id', requirePermission('role.manage'), roleController.updateRole)

