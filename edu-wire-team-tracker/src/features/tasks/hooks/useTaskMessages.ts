import { useQuery } from '@tanstack/react-query'
import { taskMessageService } from '../services/taskMessageService'
import { taskMessageKeys } from './taskMessageKeys'
import type { TaskMessagesResponse } from '../types/taskMessage.types'

/**
 * Fetches messages for a task discussion thread.
 * Uses a moderate refetch interval when the tab is focused so new messages
 * from other participants appear without a manual reload.
 * Does NOT poll in hidden background tabs.
 */
export function useTaskMessages(taskId: string, enabled = true) {
  return useQuery<TaskMessagesResponse>({
    queryKey: taskMessageKeys.all(taskId),
    queryFn: () => taskMessageService.getMessages(taskId, { limit: 100 }),
    enabled: Boolean(taskId) && enabled,
    staleTime: 10 * 1000, // 10 s — allows fast navigation between tabs
    refetchInterval: (query) => {
      // Poll every 15 s when the window is focused; stop when hidden
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return false
      }
      // If there's data and no error keep polling
      return query.state.status === 'error' ? false : 15_000
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

