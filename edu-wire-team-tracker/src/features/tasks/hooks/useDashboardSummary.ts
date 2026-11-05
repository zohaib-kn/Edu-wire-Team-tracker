import { useQuery } from '@tanstack/react-query'
import { taskService } from '../services/taskService'
import { taskKeys } from './queryKeys'
import type { TaskSummary } from '../types/task.types'

export function useDashboardSummary(filters?: { branch?: string; team?: string }) {
  return useQuery<TaskSummary>({
    queryKey: taskKeys.summary(filters || {}),
    queryFn: () => taskService.getSummary(filters),
  })
}

