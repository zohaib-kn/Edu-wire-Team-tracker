export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'normal' | 'high'
export type TaskLevel = 'standalone' | 'parent' | 'subtask'

export interface SubtaskItem {
  id: string
  title: string
  owner: string
  ownerId: string
  responsibilityLabel?: string | null
  note?: string
  due: string
  priority: TaskPriority
  status: TaskStatus
  isRequired: boolean
  doneAt?: string | null
  createdAt?: string
}

export interface TaskProgressSummary {
  totalSubtasks: number
  completedSubtasks: number
  pendingSubtasks: number
  requiredSubtasks: number
  completedRequiredSubtasks: number
  progressPercentage: number
}

export interface ParentTaskRef {
  id: string
  title: string
  due: string
  priority: TaskPriority
  status: TaskStatus
}

export interface Task {
  id: string
  title: string
  note?: string
  team: string
  teamId?: string
  branch: string
  branchId?: string
  owner: string
  ownerId?: string
  reportingManager?: string
  reportingManagerId?: string
  createdBy: string
  createdById?: string
  due: string // YYYY-MM-DD
  priority: TaskPriority
  status: TaskStatus
  taskLevel?: TaskLevel
  parentTask?: ParentTaskRef | string | null
  parentTaskId?: string | null
  responsibilityLabel?: string | null
  isRequired?: boolean
  subtasks?: SubtaskItem[]
  progress?: TaskProgressSummary
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
  reporting?: 'me' | string
  reportingManager?: string
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

export interface SubtaskInputPayload {
  title: string
  owner: string
  responsibilityLabel?: string
  note?: string
  due?: string
  priority?: TaskPriority
  isRequired?: boolean
}

export interface CreateTaskPayload {
  title: string
  team: string
  branch?: string
  owner?: string
  reportingManager?: string
  due: string // YYYY-MM-DD
  priority: TaskPriority
  note?: string
  responsibilityLabel?: string
  isRequired?: boolean
  subtasks?: SubtaskInputPayload[]
}

export interface CreateSubtaskPayload {
  title: string
  owner: string
  responsibilityLabel?: string
  note?: string
  due?: string
  priority?: TaskPriority
  isRequired?: boolean
}

export interface UpdateTaskPayload {
  title?: string
  note?: string
  owner?: string
  reportingManager?: string
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
  branch?: string
  lead?: string
  leadId?: string
  leadName?: string
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
  role?: string
}

