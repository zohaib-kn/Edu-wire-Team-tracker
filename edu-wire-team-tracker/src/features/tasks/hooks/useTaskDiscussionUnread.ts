import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskMessageService } from '../services/taskMessageService'
import { taskMessageKeys } from './taskMessageKeys'
import { notificationKeys } from '@/features/notifications/hooks/useNotifications'

/**
 * Polls for unread discussion messages for the given task.
 * Refetches every 15s in the foreground.
 */
export function useTaskDiscussionUnread(taskId: string) {
  return useQuery({
    queryKey: taskMessageKeys.unread(taskId),
    queryFn: () => taskMessageService.getUnreadCount(taskId),
    enabled: Boolean(taskId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

/**
 * Marks discussion messages as read for the given task.
 * On success, invalidates the unread discussion query AND notifications query.
 */
export function useMarkDiscussionAsRead(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => taskMessageService.markAsRead(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskMessageKeys.unread(taskId) })
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
