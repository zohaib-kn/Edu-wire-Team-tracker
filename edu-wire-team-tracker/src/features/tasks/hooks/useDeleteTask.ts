import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (taskId: string) => taskService.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Task deleted', {
        description: 'The task has been removed.',
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to delete task', {
        description: parsed.message,
      })
    },
  })
}

