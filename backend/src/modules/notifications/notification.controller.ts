import type { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { Notification } from '../../models/Notification.js'
import { AppError } from '../../utils/AppError.js'

export const notificationController = {
  /**
   * GET /api/v1/notifications
   * Returns web-channel notifications for the authenticated user, newest first.
   * Query: ?unreadOnly=true  → only returns status:'queued' (unread) records
   */
  async getMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const unreadOnly = req.query.unreadOnly === 'true'

      const filter: Record<string, any> = {
        user: new mongoose.Types.ObjectId(req.user.id),
        channel: 'web',
      }

      if (unreadOnly) {
        filter.status = 'queued'
      }

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec()

      // Map to a clean frontend-friendly shape
      const formatted = notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        status: n.status,
        taskId: n.task ? n.task.toString() : null,
        title: (n.providerPayload as any)?.title ?? 'New Notification',
        body: (n.providerPayload as any)?.body ?? '',
        deepLink: (n.providerPayload as any)?.deepLink ?? null,
        createdAt: n.createdAt.toISOString(),
      }))

      const unreadCount = formatted.filter((n) => n.status === 'queued').length

      res.status(200).json({
        success: true,
        notifications: formatted,
        unreadCount,
        total: formatted.length,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   * Marks a single notification as read (status: 'sent') for the authenticated user.
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '')

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest('Invalid notification ID', 'INVALID_ID')
      }

      const notification = await Notification.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(id),
          user: new mongoose.Types.ObjectId(req.user.id),
          channel: 'web',
        },
        {
          $set: { status: 'sent', sentAt: new Date() },
        },
        { new: true },
      ).exec()

      if (!notification) {
        throw AppError.notFound('Notification not found', 'NOT_FOUND')
      }

      res.status(200).json({ success: true, message: 'Notification marked as read' })
    } catch (error) {
      next(error)
    }
  },

  /**
   * PATCH /api/v1/notifications/read-all
   * Marks ALL unread web notifications for the authenticated user as read.
   */
  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const result = await Notification.updateMany(
        {
          user: new mongoose.Types.ObjectId(req.user.id),
          channel: 'web',
          status: 'queued',
        },
        {
          $set: { status: 'sent', sentAt: new Date() },
        },
      ).exec()

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        updatedCount: result.modifiedCount,
      })
    } catch (error) {
      next(error)
    }
  },
}

