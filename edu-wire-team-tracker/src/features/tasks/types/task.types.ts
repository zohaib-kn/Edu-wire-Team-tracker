export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'normal' | 'high'

export interface Task {
  id: string
  title: string
  note?: string
  team: string
  branch: string
  owner: string
  createdBy: string
  due: string // YYYY-MM-DD
  priority: TaskPriority
  status: TaskStatus
  doneAt?: string | null
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
  activity?: TaskActivity[]
}

export interface TaskSummary {
  late: number
  today: number
  pending: number
  done7Days: number
  total?: number
}

export type TaskActivityAction =
  | 'created'
  | 'edited'
  | 'status_changed'
  | 'deleted'

export interface TaskActivityFieldChange {
  field: string
  oldValue?: unknown
  newValue?: unknown
}

export interface TaskActivity {
  id: string
  taskId?: string
  action: TaskActivityAction
  user: string
  timestamp: string
  fieldChanges?: TaskActivityFieldChange[]
  details?: string
}

export interface TaskFilterParams {
  team?: string
  branch?: string
  status?: TaskStatus | 'all'
  owner?: 'me' | string
  due?: 'late' | 'today' | 'all'
  q?: string
  priority?: TaskPriority | 'all'
  page?: number
  limit?: number
}

export interface TasksListResponse {
  tasks: Task[]
  total?: number
  page?: number
  limit?: number
  totalPages?: number
}

export interface CreateTaskPayload {
  title: string
  team: string
  owner: string
  due: string // YYYY-MM-DD
  priority: TaskPriority
  note?: string
}

export interface UpdateTaskPayload {
  title?: string
  note?: string
  owner?: string
  due?: string // YYYY-MM-DD
  priority?: TaskPriority
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus
}

export interface TeamOption {
  id: string
  name: string
  branchId?: string
}

export interface BranchOption {
  id: string
  name: string
}

export interface TeamMemberOption {
  id: string
  name: string
  email?: string
  teamId?: string
}

