import { taskKeys } from './queryKeys'

export const taskMessageKeys = {
  all: (taskId: string) => [...taskKeys.detail(taskId), 'messages'] as const,
  page: (taskId: string, cursor?: string) =>
    [...taskMessageKeys.all(taskId), 'page', cursor ?? 'first'] as const,
  unread: (taskId: string) => [...taskKeys.detail(taskId), 'discussionUnread'] as const,
}

