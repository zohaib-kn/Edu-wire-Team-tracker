import { Router } from 'express'
import { notificationController } from './notification.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'

export const notificationRouter = Router()

// All notification routes require a valid session
notificationRouter.use(authenticate)
notificationRouter.use(requirePasswordChangeCompleted)

// GET  /api/v1/notifications           → fetch my notifications (supports ?unreadOnly=true)
notificationRouter.get('/', notificationController.getMyNotifications)

// PATCH /api/v1/notifications/read-all → mark all unread as read (must be before /:id/read)
notificationRouter.patch('/read-all', notificationController.markAllRead)

// PATCH /api/v1/notifications/:id/read → mark single notification as read
notificationRouter.patch('/:id/read', notificationController.markAsRead)

