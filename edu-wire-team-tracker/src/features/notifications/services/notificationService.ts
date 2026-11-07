import { apiClient } from '@/lib/api/apiClient'
import type { NotificationsResponse } from '../types/notification.types'

export const notificationService = {
  /**
   * GET /api/v1/notifications
   * Fetches web notifications for the current user.
   * Pass unreadOnly=true to only get unread (status:'queued') records.
   */
  async getMyNotifications(unreadOnly = false): Promise<NotificationsResponse> {
    const params: Record<string, string> = {}
    if (unreadOnly) params.unreadOnly = 'true'

    const response = await apiClient.get<NotificationsResponse>('/notifications', { params })
    return response.data
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   * Marks a single notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${encodeURIComponent(id)}/read`)
  },

  /**
   * PATCH /api/v1/notifications/read-all
   * Marks all unread notifications for the current user as read.
   */
  async markAllRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all')
  },
}

