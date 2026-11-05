import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, Filter, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useMyTasks } from '@/features/tasks/hooks/useMyTasks'
import { TaskCard } from '@/features/tasks/components/TaskCard'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { TaskDeleteDialog } from '@/features/tasks/components/TaskDeleteDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { canPerformTaskAction } from '@/features/tasks/utils/taskPermissions'
import type { Task, TaskPriority, TaskStatus } from '@/features/tasks/types/task.types'

export function MyTasksPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter state synchronized with URL search params
  const searchQuery = searchParams.get('q') || ''
  const statusFilter = (searchParams.get('status') as TaskStatus | 'all') || 'all'
  const dueFilter = (searchParams.get('due') as 'late' | 'today' | 'all') || 'all'
  const priorityFilter = (searchParams.get('priority') as TaskPriority | 'all') || 'all'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const limit = 12

  // Fetch tasks with owner=me
  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useMyTasks({
    q: searchQuery,
    status: statusFilter,
    due: dueFilter,
    priority: priorityFilter,
    page: currentPage,
    limit,
  })

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="My Tasks"
        description="Tasks assigned to you across branches and teams"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              aria-label="Refresh my tasks"
            >
              Refresh
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
                Create Task
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              id="search"
              type="search"
              placeholder="Search my tasks..."
              value={searchQuery}
              onChange={(e) => updateFilter('q', e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
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
              <option value="done">Done</option>
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
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Active filters applied</span>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-[#1D4ED8] hover:underline font-medium ml-2 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Task Content Listing */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="lg" className="text-[#1D4ED8] mb-3" />
          <p className="text-sm">Loading your tasks...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-800">
          <p className="font-semibold mb-1">Failed to load personal tasks</p>
          <p className="text-xs text-red-600 mb-4">
            Could not communicate with the tasks server.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : displayedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">
            No tasks found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4 px-2">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} ({totalTasks} total tasks)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => updateFilter('page', String(currentPage - 1))}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateFilter('page', String(currentPage + 1))}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
