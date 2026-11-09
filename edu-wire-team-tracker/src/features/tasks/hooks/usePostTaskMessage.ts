import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskMessageService } from '../services/taskMessageService'
import { taskMessageKeys } from './taskMessageKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import type { TaskMessage, CreateTaskMessagePayload } from '../types/taskMessage.types'

export function usePostTaskMessage(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation<TaskMessage, Error, CreateTaskMessagePayload>({
    mutationFn: (payload) => taskMessageService.postMessage(taskId, payload),

    onSuccess: () => {
      // Invalidate the entire message list so the sent message appears immediately
      queryClient.invalidateQueries({ queryKey: taskMessageKeys.all(taskId) })
      queryClient.invalidateQueries({ queryKey: taskMessageKeys.unread(taskId) })
    },

    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to send message', {
        description: parsed.message,
      })
    },
  })
}

