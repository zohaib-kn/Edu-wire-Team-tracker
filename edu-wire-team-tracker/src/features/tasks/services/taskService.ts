import { apiClient } from '@/lib/api/apiClient'
import type {
  CreateSubtaskPayload,
  CreateTaskPayload,
  Task,
  TaskFilterParams,
  TasksListResponse,
  TaskStatus,
  TaskSummary,
  UpdateTaskPayload,
} from '../types/task.types'

export const taskService = {
  /**
   * Fetches dashboard summary counts from GET /api/v1/summary
   */
  async getSummary(filters?: { branch?: string; team?: string }): Promise<TaskSummary> {
    const params: Record<string, string> = {}
    if (filters?.branch && filters.branch !== 'all') params.branch = filters.branch
    if (filters?.team && filters.team !== 'all') params.team = filters.team

    const response = await apiClient.get<TaskSummary | { data: TaskSummary } | { summary: TaskSummary }>(
      '/summary',
      { params },
    )

    const raw = response.data as Record<string, unknown>
    const data = (raw?.data || raw?.summary || raw) as TaskSummary

    return {
      late: Number(data?.late ?? 0),
      today: Number(data?.today ?? 0),
      pending: Number(data?.pending ?? 0),
      done7Days: Number(data?.done7Days ?? 0),
      total: data?.total,
    }
  },

  /**
   * Fetches task list from GET /api/v1/tasks
   */
  async getTasks(filters?: TaskFilterParams): Promise<TasksListResponse> {
    const params: Record<string, string | number> = {}

    if (filters?.team && filters.team !== 'all') params.team = filters.team
    if (filters?.branch && filters.branch !== 'all') params.branch = filters.branch
    if (filters?.status && filters.status !== 'all') params.status = filters.status
    if (filters?.owner) params.owner = filters.owner
    if (filters?.reporting) params.reporting = filters.reporting
    if (filters?.reportingManager) params.reportingManager = filters.reportingManager
    if (filters?.due && filters.due !== 'all') params.due = filters.due
    if (filters?.q && filters.q.trim()) params.q = filters.q.trim()
    if (filters?.page) params.page = filters.page
    if (filters?.limit) params.limit = filters.limit

    const response = await apiClient.get<
      Task[] | TasksListResponse | { data: Task[]; total?: number }
    >('/tasks', { params })

    const raw = response.data

    if (Array.isArray(raw)) {
      return { tasks: raw, total: raw.length }
    }
    if (raw && typeof raw === 'object' && 'tasks' in raw && Array.isArray(raw.tasks)) {
      return raw as TasksListResponse
    }
    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray(raw.data)) {
      return {
        tasks: raw.data,
        total: (raw as { total?: number }).total ?? raw.data.length,
      }
    }

    return { tasks: [], total: 0 }
  },

  /**
   * Fetches task details and activity log from GET /api/v1/tasks/:id
   */
  async getTaskById(id: string): Promise<Task> {
    const response = await apiClient.get<Task | { data: Task } | { task: Task }>(
      `/tasks/${encodeURIComponent(id)}`,
    )
    const raw = response.data as Record<string, unknown>
    const task = (raw?.data || raw?.task || raw) as Task
    return task
  },

  /**
   * Submits new task to POST /api/v1/tasks
   */
  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const response = await apiClient.post<Task | { data: Task } | { task: Task }>(
      '/tasks',
      payload,
    )
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.task || raw) as Task
  },

  /**
   * Adds a subtask to an existing task via POST /api/v1/tasks/:id/subtasks
   */
  async createSubtask(taskId: string, payload: CreateSubtaskPayload): Promise<Task> {
    const response = await apiClient.post<Task | { data: Task } | { task: Task }>(
      `/tasks/${encodeURIComponent(taskId)}/subtasks`,
      payload,
    )
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.task || raw) as Task
  },

  /**
   * Updates task details via PATCH /api/v1/tasks/:id
   */
  async updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
    const response = await apiClient.patch<Task | { data: Task } | { task: Task }>(
      `/tasks/${encodeURIComponent(id)}`,
      payload,
    )
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.task || raw) as Task
  },

  /**
   * Updates task status via PATCH /api/v1/tasks/:id/status
   */
  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    const response = await apiClient.patch<Task | { data: Task } | { task: Task }>(
      `/tasks/${encodeURIComponent(id)}/status`,
      { status },
    )
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.task || raw) as Task
  },

  /**
   * Soft deletes a task via DELETE /api/v1/tasks/:id
   */
  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/tasks/${encodeURIComponent(id)}`)
  },
}

