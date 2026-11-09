import type { Request, Response, NextFunction } from 'express'
import { taskMessageService } from './taskMessage.service.js'
import {
  createTaskMessageSchema,
  getTaskMessagesQuerySchema,
} from './taskMessage.schemas.js'
import { AppError } from '../../utils/AppError.js'

export const taskMessageController = {
  /**
   * POST /api/v1/tasks/:id/messages
   * Post a new message in the task discussion thread.
   */
  async createMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id) {
        throw AppError.badRequest('Task ID is required', 'TASK_ID_REQUIRED')
      }

      const validated = createTaskMessageSchema.parse(req.body)
      const message = await taskMessageService.createMessage(id, validated, req.user)

      res.status(201).json({
        success: true,
        data: message,
        message,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/v1/tasks/:id/messages
   * Retrieve chronological, paginated messages for a task discussion thread.
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id) {
        throw AppError.badRequest('Task ID is required', 'TASK_ID_REQUIRED')
      }

      const validatedQuery = getTaskMessagesQuerySchema.parse(req.query)
      const result = await taskMessageService.getMessages(id, validatedQuery, req.user)

      res.status(200).json({
        success: true,
        data: result.messages,
        messages: result.messages,
        total: result.total,
        limit: result.limit,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/v1/tasks/:id/discussion/unread
   * Get unread message count and last read timestamp for the current user.
   */
  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id) {
        throw AppError.badRequest('Task ID is required', 'TASK_ID_REQUIRED')
      }

      const result = await taskMessageService.getUnreadCount(id, req.user)

      res.status(200).json({
        success: true,
        unreadCount: result.unreadCount,
        lastReadAt: result.lastReadAt,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/tasks/:id/discussion/mark-read
   * Updates discussion read cursor and marks web notifications read.
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id) {
        throw AppError.badRequest('Task ID is required', 'TASK_ID_REQUIRED')
      }

      const result = await taskMessageService.markDiscussionAsRead(id, req.user)

      res.status(200).json({
        success: true,
        message: 'Discussion marked as read',
        lastReadAt: result.lastReadAt,
      })
    } catch (error) {
      next(error)
    }
  },
}

