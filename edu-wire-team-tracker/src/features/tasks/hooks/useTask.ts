import { useQuery } from '@tanstack/react-query'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import type { Task } from '../types/task.types'

export function useTask(id: string) {
  return useQuery<Task>({
    queryKey: taskKeys.detail(id),
    queryFn: () => taskService.getTaskById(id),
    enabled: Boolean(id),
  })
}

