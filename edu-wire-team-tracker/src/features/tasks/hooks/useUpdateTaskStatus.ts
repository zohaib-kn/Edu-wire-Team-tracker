import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import { triggerCelebration } from '../utils/celebrationTrigger'
import type { Task, TaskStatus } from '../types/task.types'

export interface UpdateStatusArgs {
  id: string
  status: TaskStatus
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation<Task, Error, UpdateStatusArgs>({
    mutationFn: ({ id, status }) => taskService.updateTaskStatus(id, status),
    onSuccess: (updatedTask) => {
      // Invalidate both lists, summaries, and individual detail
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.setQueryData(taskKeys.detail(updatedTask.id), updatedTask)

      if (updatedTask.status === 'done') {
        triggerCelebration(updatedTask.title)
        toast.success('Task Completed!', {
          description: `"${updatedTask.title}" has been saved to Task History.`,
        })
      } else {
        const statusLabels: Record<TaskStatus, string> = {
          todo: 'To Do',
          doing: 'In Progress',
          done: 'Done',
        }
        toast.success('Status updated', {
          description: `Task is now ${statusLabels[updatedTask.status] || updatedTask.status}.`,
        })
      }
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update status', {
        description: parsed.message,
      })
    },
  })
}

