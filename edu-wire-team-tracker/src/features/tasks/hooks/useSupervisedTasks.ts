import { useQuery } from '@tanstack/react-query'
import { taskService } from '../services/taskService'
import type { TaskFilterParams, TasksListResponse } from '../types/task.types'

export function useSupervisedTasks(filters?: Omit<TaskFilterParams, 'reporting'>) {
  const mergedFilters: TaskFilterParams = {
    ...filters,
    reporting: 'me',
  }

  return useQuery<TasksListResponse>({
    queryKey: ['tasks', 'supervised', mergedFilters],
    queryFn: () => taskService.getTasks(mergedFilters),
  })
}

