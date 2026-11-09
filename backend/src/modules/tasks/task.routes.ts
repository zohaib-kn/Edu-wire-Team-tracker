import { Router } from 'express'
import { taskController } from './task.controller.js'
import { taskMessageController } from './taskMessage.controller.js'
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

// POST /api/v1/tasks/:id/subtasks - Add a subtask to an existing task
taskRouter.post('/:id/subtasks', requirePermission('task.create'), taskController.createSubtask)

// Task Discussion / Messages
// GET /api/v1/tasks/:id/messages - Retrieve task discussion messages
taskRouter.get('/:id/messages', taskMessageController.getMessages)

// POST /api/v1/tasks/:id/messages - Post message to task discussion
taskRouter.post('/:id/messages', taskMessageController.createMessage)

// GET /api/v1/tasks/:id/discussion/unread - Get unread count for current user
taskRouter.get('/:id/discussion/unread', taskMessageController.getUnreadCount)

// POST /api/v1/tasks/:id/discussion/mark-read - Mark discussion as read for current user
taskRouter.post('/:id/discussion/mark-read', taskMessageController.markAsRead)

// GET /api/v1/tasks/:id - Single task details
taskRouter.get('/:id', requirePermission('task.view'), taskController.getTaskById)

// PATCH /api/v1/tasks/:id - Update task details
taskRouter.patch('/:id', requirePermission('task.edit'), taskController.updateTask)

// PATCH /api/v1/tasks/:id/status - Update task status directly
taskRouter.patch('/:id/status', requirePermission('task.status'), taskController.updateTaskStatus)

// DELETE /api/v1/tasks/:id - Soft-delete task
taskRouter.delete('/:id', requirePermission('task.delete'), taskController.deleteTask)


