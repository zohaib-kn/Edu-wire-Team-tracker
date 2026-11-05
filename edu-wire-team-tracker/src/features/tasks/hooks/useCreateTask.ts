import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import type { CreateTaskPayload, Task } from '../types/task.types'

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation<Task, Error, CreateTaskPayload>({
    mutationFn: (payload) => taskService.createTask(payload),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Task created successfully', {
        description: `"${newTask.title}" has been created.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to create task', {
        description: parsed.message,
      })
    },
  })
}

