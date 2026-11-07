import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  CheckCircle2,
  User,
  ShieldCheck,
  Inbox,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useMyTasks } from '@/features/tasks/hooks/useMyTasks'
import { useSupervisedTasks } from '@/features/tasks/hooks/useSupervisedTasks'
import { TaskCard } from '@/features/tasks/components/TaskCard'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { TaskDeleteDialog } from '@/features/tasks/components/TaskDeleteDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Pagination } from '@/components/ui/Pagination'
import { usePageHeader } from '@/context/HeaderContext'
import { cn } from '@/lib/utils/cn'
import { canPerformTaskAction } from '@/features/tasks/utils/taskPermissions'
import type { Task, TaskPriority, TaskStatus } from '@/features/tasks/types/task.types'

export function MyTasksPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const viewMode = searchParams.get('view') === 'supervised' ? 'supervised' : 'assigned'

  // Filter state synchronized with URL search params
  const searchQuery = searchParams.get('q') || ''
  const statusFilter = (searchParams.get('status') as TaskStatus | 'all') || 'all'
  const dueFilter = (searchParams.get('due') as 'late' | 'today' | 'all') || 'all'
  const priorityFilter = (searchParams.get('priority') as TaskPriority | 'all') || 'all'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const limit = 12

  // Queries for assigned vs supervised tasks
  const myTasksQuery = useMyTasks({
    q: searchQuery,
    status: statusFilter,
    due: dueFilter,
    priority: priorityFilter,
    page: currentPage,
    limit,
  })

  const supervisedTasksQuery = useSupervisedTasks({
    q: searchQuery,
    status: statusFilter,
    due: dueFilter,
    priority: priorityFilter,
    page: currentPage,
    limit,
  })

  const activeQuery = viewMode === 'supervised' ? supervisedTasksQuery : myTasksQuery
  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = activeQuery

  // Sheet & Dialog state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const canCreate = canPerformTaskAction(user, 'create')

  // URL search parameter updater
  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === 'all' || !value.trim()) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      // Reset page to 1 on filter changes
      if (key !== 'page') {
        next.delete('page')
      }
      return next
    })
  }

  const tasks = useMemo(() => tasksData?.tasks || [], [tasksData?.tasks])
  const totalTasks = tasksData?.total ?? tasks.length
  const totalPages = Math.ceil(totalTasks / limit) || 1

  // Client-side priority filter fallback if server didn't filter
  const displayedTasks = useMemo(() => {
    if (priorityFilter === 'all') return tasks
    return tasks.filter((t) => t.priority === priorityFilter)
  }, [tasks, priorityFilter])

  // Top Header synchronization
  usePageHeader({
    title: viewMode === 'supervised' ? 'Supervised Tasks' : 'My Tasks',
    subtitle:
      viewMode === 'supervised'
        ? 'Tasks assigned to team members under your supervision'
        : 'Tasks assigned to you across branches and teams',
    actions: (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          aria-label="Refresh tasks"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTaskToEdit(null)
              setIsSheetOpen(true)
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Create Task</span>
          </Button>
        )}
      </div>
    ),
  })

  return (
    <div className="space-y-6">
      {/* View Switcher Tabs & Quick Status Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Assigned vs Supervised Pill Switcher */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-full border border-border-subtle shadow-xs">
          <button
            type="button"
            onClick={() => updateFilter('view', 'assigned')}
            className={cn(
              'flex items-center gap-2 py-1.5 px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'assigned'
                ? 'bg-pill-dark text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span>Assigned to Me</span>
          </button>
          <button
            type="button"
            onClick={() => updateFilter('view', 'supervised')}
            className={cn(
              'flex items-center gap-2 py-1.5 px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'supervised'
                ? 'bg-pill-dark text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Supervised</span>
          </button>
        </div>

        {/* Quick Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => updateFilter('status', 'all')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              statusFilter === 'all'
                ? 'bg-pill-dark text-white border-pill-dark shadow-xs font-semibold'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            All Tasks
          </button>
          <button
            type="button"
            onClick={() => updateFilter('status', 'todo')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              statusFilter === 'todo'
                ? 'bg-tint-blue-bg text-tint-blue-text border-tint-blue-border font-semibold shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            To Do
          </button>
          <button
            type="button"
            onClick={() => updateFilter('status', 'doing')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              statusFilter === 'doing'
                ? 'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border font-semibold shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            In Progress
          </button>
          <button
            type="button"
            onClick={() => updateFilter('status', 'done')}
            className={cn(
              'inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              statusFilter === 'done'
                ? 'bg-tint-green-bg text-tint-green-text border-tint-green-border font-semibold shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border-subtle rounded-card p-4 shadow-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              id="search"
              type="search"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => updateFilter('q', e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select
              id="status"
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="doing">In Progress</option>
              <option value="done">Completed</option>
            </Select>
          </div>

          {/* Due Filter */}
          <div>
            <Select
              id="due"
              value={dueFilter}
              onChange={(e) => updateFilter('due', e.target.value)}
            >
              <option value="all">All Due Dates</option>
              <option value="today">Due Today</option>
              <option value="late">Overdue</option>
            </Select>
          </div>

          {/* Priority Filter */}
          <div>
            <Select
              id="priority"
              value={priorityFilter}
              onChange={(e) => updateFilter('priority', e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal Priority</option>
            </Select>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(searchQuery || statusFilter !== 'all' || dueFilter !== 'all' || priorityFilter !== 'all') && (
          <div className="flex items-center gap-2 pt-2 border-t border-border-subtle/50 text-xs text-text-muted">
            <Filter className="w-3.5 h-3.5" />
            <span>Active filters applied</span>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-brand-blue hover:underline font-semibold ml-2 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Task Content Listing */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <Spinner size="lg" className="text-brand-blue mb-3" />
          <p className="text-sm font-medium">Loading tasks...</p>
        </div>
      ) : isError ? (
        <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 text-center text-sm text-tint-red-text">
          <p className="font-semibold mb-1">Failed to load personal tasks</p>
          <p className="text-xs text-destructive mb-4">
            Could not communicate with the tasks server.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : displayedTasks.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-subtle bg-surface/50 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-text-muted mx-auto mb-3">
            <Inbox className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            No tasks found
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            {searchQuery || statusFilter !== 'all' || dueFilter !== 'all' || priorityFilter !== 'all'
              ? 'No tasks match your current filter criteria. Try clearing some filters.'
              : 'You have no assigned tasks on your board right now.'}
          </p>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTaskToEdit(null)
                setIsSheetOpen(true)
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Create New Task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={(t) => {
                  setTaskToEdit(t)
                  setIsSheetOpen(true)
                }}
                onDelete={(t) => setTaskToDelete(t)}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalTasks}
            itemName="tasks"
            onPageChange={(page) => updateFilter('page', String(page))}
          />
        </div>
      )}

      {/* Task Create / Edit Sheet */}
      <TaskFormSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        taskToEdit={taskToEdit}
      />

      {/* Task Delete Confirmation Dialog */}
      <TaskDeleteDialog
        isOpen={Boolean(taskToDelete)}
        task={taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
