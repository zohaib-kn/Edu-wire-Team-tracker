import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import type { CreateSubtaskPayload, Task } from '../types/task.types'

export function useCreateSubtask(parentTaskId: string) {
  const queryClient = useQueryClient()

  return useMutation<Task, Error, CreateSubtaskPayload>({
    mutationFn: (payload) => taskService.createSubtask(parentTaskId, payload),
    onSuccess: (newSubtask) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(parentTaskId) })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Subtask added successfully', {
        description: `"${newSubtask.title}" has been assigned to ${newSubtask.owner}.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to add subtask', {
        description: parsed.message,
      })
    },
  })
}
