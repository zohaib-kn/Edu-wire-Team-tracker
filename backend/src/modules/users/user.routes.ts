import { Router } from 'express'
import { userController } from './user.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const userRouter = Router()

userRouter.use(authenticate)
userRouter.use(requirePasswordChangeCompleted)

// GET /api/v1/users
userRouter.get('/', requirePermission('user.manage'), userController.getUsers)

// POST /api/v1/users
userRouter.post('/', requirePermission('user.manage'), userController.createUser)

// PATCH /api/v1/users/:id
userRouter.patch('/:id', requirePermission('user.manage'), userController.updateUser)

// POST /api/v1/users/:id/reset-password
userRouter.post('/:id/reset-password', requirePermission('user.manage'), userController.resetPassword)

