export type NotificationStatus = 'queued' | 'sent' | 'skipped' | 'failed'

export type NotificationType =
  | 'task_assigned'
  | 'task_supervised'
  | 'task_reassigned'
  | 'task_reminder'
  | string

export interface AppNotification {
  id: string
  type: NotificationType
  status: NotificationStatus
  taskId: string | null
  title: string
  body: string
  deepLink: string | null
  createdAt: string
}

export interface NotificationsResponse {
  success: boolean
  notifications: AppNotification[]
  unreadCount: number
  total: number
}

