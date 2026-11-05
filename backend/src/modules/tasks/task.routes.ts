import { Router } from 'express'
import { taskController } from './task.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const taskRouter = Router()

// All task routes require authentication and completed password change
taskRouter.use(authenticate)
taskRouter.use(requirePasswordChangeCompleted)

// GET /api/v1/tasks - List tasks
taskRouter.get('/', requirePermission('task.view'), taskController.getTasks)

// POST /api/v1/tasks - Create task
taskRouter.post('/', requirePermission('task.create'), taskController.createTask)

// GET /api/v1/tasks/:id - Single task details
taskRouter.get('/:id', requirePermission('task.view'), taskController.getTaskById)

// PATCH /api/v1/tasks/:id - Update task details
taskRouter.patch('/:id', requirePermission('task.edit'), taskController.updateTask)

// PATCH /api/v1/tasks/:id/status - Update task status directly
taskRouter.patch('/:id/status', requirePermission('task.status'), taskController.updateTaskStatus)

// DELETE /api/v1/tasks/:id - Soft-delete task
taskRouter.delete('/:id', requirePermission('task.delete'), taskController.deleteTask)

