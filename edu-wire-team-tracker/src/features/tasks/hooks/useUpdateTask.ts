import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import type { Task, UpdateTaskPayload } from '../types/task.types'

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation<Task, Error, UpdateTaskPayload>({
    mutationFn: (payload) => taskService.updateTask(taskId, payload),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.setQueryData(taskKeys.detail(taskId), updatedTask)
      toast.success('Task updated successfully', {
        description: `Changes to "${updatedTask.title}" have been saved.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update task', {
        description: parsed.message,
      })
    },
  })
}

