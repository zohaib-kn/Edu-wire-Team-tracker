export type NotificationStatus = 'queued' | 'sent' | 'skipped' | 'failed'

export type NotificationType =
  | 'task_assigned'
  | 'task_supervised'
  | 'task_reassigned'
  | 'task_reminder'
  | 'task_discussion_message'
  | 'task_completed'
  | 'deadline_warning'
  | 'deadline_escalation'
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

