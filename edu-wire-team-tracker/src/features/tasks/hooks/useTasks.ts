import { useQuery } from '@tanstack/react-query'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import type { TaskFilterParams, TasksListResponse } from '../types/task.types'

export function useTasks(filters?: TaskFilterParams) {
  return useQuery<TasksListResponse>({
    queryKey: taskKeys.list((filters || {}) as Record<string, unknown>),
    queryFn: () => taskService.getTasks(filters),
  })
}

