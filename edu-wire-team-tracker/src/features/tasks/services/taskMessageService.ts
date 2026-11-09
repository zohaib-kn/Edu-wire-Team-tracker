import { apiClient } from '@/lib/api/apiClient'
import type {
  TaskMessage,
  TaskMessagesResponse,
  CreateTaskMessagePayload,
} from '../types/taskMessage.types'

export const taskMessageService = {
  /**
   * Fetches paginated messages for a task's discussion thread.
   * GET /api/v1/tasks/:taskId/messages
   */
  async getMessages(
    taskId: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<TaskMessagesResponse> {
    const queryParams: Record<string, string | number> = {}
    if (params?.cursor) queryParams.cursor = params.cursor
    if (params?.limit) queryParams.limit = params.limit

    const response = await apiClient.get<TaskMessagesResponse>(
      `/tasks/${encodeURIComponent(taskId)}/messages`,
      { params: queryParams },
    )

    const raw = response.data as unknown as Record<string, unknown>
    const messages = (
      Array.isArray(raw?.messages)
        ? raw.messages
        : Array.isArray(raw?.data)
          ? raw.data
          : []
    ) as TaskMessage[]

    return {
      messages,
      total: (raw?.total as number) ?? messages.length,
      limit: (raw?.limit as number) ?? 50,
      nextCursor: (raw?.nextCursor as string | null) ?? null,
      hasMore: (raw?.hasMore as boolean) ?? false,
    }
  },

  /**
   * Posts a new message to a task's discussion thread.
   * POST /api/v1/tasks/:taskId/messages
   */
  async postMessage(
    taskId: string,
    payload: CreateTaskMessagePayload,
  ): Promise<TaskMessage> {
    const response = await apiClient.post<
      TaskMessage | { data: TaskMessage } | { message: TaskMessage }
    >(`/tasks/${encodeURIComponent(taskId)}/messages`, payload)

    const raw = response.data as unknown as Record<string, unknown>
    return (raw?.data || raw?.message || raw) as TaskMessage
  },

  /**
   * Fetches the unread discussion message count for the current user.
   * GET /api/v1/tasks/:taskId/discussion/unread
   */
  async getUnreadCount(
    taskId: string,
  ): Promise<{ unreadCount: number; lastReadAt: string | null }> {
    const response = await apiClient.get<{
      success: boolean
      unreadCount: number
      lastReadAt: string | null
    }>(`/tasks/${encodeURIComponent(taskId)}/discussion/unread`)

    return {
      unreadCount: response.data?.unreadCount ?? 0,
      lastReadAt: response.data?.lastReadAt ?? null,
    }
  },

  /**
   * Marks discussion messages as read for the current user.
   * POST /api/v1/tasks/:taskId/discussion/mark-read
   */
  async markAsRead(
    taskId: string,
  ): Promise<{ success: boolean; lastReadAt: string }> {
    const response = await apiClient.post<{
      success: boolean
      message: string
      lastReadAt: string
    }>(`/tasks/${encodeURIComponent(taskId)}/discussion/mark-read`)

    return {
      success: response.data?.success ?? true,
      lastReadAt: response.data?.lastReadAt ?? new Date().toISOString(),
    }
  },
}
