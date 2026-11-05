import { useQuery } from '@tanstack/react-query'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import type { TaskFilterParams, TasksListResponse } from '../types/task.types'

export function useMyTasks(filters?: Omit<TaskFilterParams, 'owner'>) {
  const mergedFilters: TaskFilterParams = {
    ...filters,
    owner: 'me',
  }

  return useQuery<TasksListResponse>({
    queryKey: taskKeys.myTasks(mergedFilters as Record<string, unknown>),
    queryFn: () => taskService.getTasks(mergedFilters),
  })
}

