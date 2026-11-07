import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Inbox,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { useBranches, useTeams } from '@/features/tasks/hooks/useMetadata'
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
import type { Task, TaskPriority } from '@/features/tasks/types/task.types'

export function TaskHistoryPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter state synchronized with URL search params
  const searchQuery = searchParams.get('q') || ''
  const branchFilter = searchParams.get('branch') || 'all'
  const teamFilter = searchParams.get('team') || 'all'
  const timeframeFilter = searchParams.get('timeframe') || 'all'
  const priorityFilter = (searchParams.get('priority') as TaskPriority | 'all') || 'all'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const limit = 12

  // Metadata queries
  const { data: branches = [] } = useBranches()
  const { data: teams = [] } = useTeams()

  // Fetch only completed tasks (status: 'done')
  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useTasks({
    status: 'done',
    branch: branchFilter !== 'all' ? branchFilter : undefined,
    team: teamFilter !== 'all' ? teamFilter : undefined,
    q: searchQuery.trim() || undefined,
    page: currentPage,
    limit,
  })

  // Sheet & Dialog state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const showBranchFilter = user?.role === 'Super Admin' || branches.length > 1

  // URL search parameter updater
  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === 'all' || !value.trim()) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      if (key !== 'page') {
        next.delete('page')
      }
      return next
    })
  }

  const rawTasks = useMemo(() => tasksData?.tasks || [], [tasksData?.tasks])

  // Filter by timeframe and priority client-side
  const filteredTasks = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return rawTasks.filter((task) => {
      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false
      }

      // Timeframe filter based on doneAt or updatedAt
      const completedDate = task.doneAt ? new Date(task.doneAt) : task.updatedAt ? new Date(task.updatedAt) : null

      if (timeframeFilter === 'today') {
        if (!completedDate) return false
        return completedDate.toISOString().slice(0, 10) === todayStr
      }

      if (timeframeFilter === '7days') {
        if (!completedDate) return false
        return completedDate >= sevenDaysAgo
      }

      if (timeframeFilter === 'month') {
        if (!completedDate) return false
        return completedDate >= startOfMonth
      }

      return true
    })
  }, [rawTasks, timeframeFilter, priorityFilter])

  const totalTasks = tasksData?.total ?? rawTasks.length
  const totalPages = Math.ceil(totalTasks / limit) || 1

  // Top Header synchronization
  usePageHeader({
    title: 'Task History',
    subtitle: 'Archive of all completed tasks with completion dates and audit records',
    actions: (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-badge text-xs font-semibold bg-tint-green-bg text-tint-green-text border border-tint-green-border">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{totalTasks} Completed Tasks</span>
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          aria-label="Refresh task history"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    ),
  })

  return (
    <div className="space-y-6">
      {/* Quick Timeframe Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => updateFilter('timeframe', 'all')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              timeframeFilter === 'all'
                ? 'bg-pill-dark text-white border-pill-dark shadow-xs font-semibold'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => updateFilter('timeframe', 'today')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              timeframeFilter === 'today'
                ? 'bg-tint-green-bg text-tint-green-text border-tint-green-border font-semibold shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            Completed Today
          </button>
          <button
            type="button"
            onClick={() => updateFilter('timeframe', '7days')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              timeframeFilter === '7days'
                ? 'bg-tint-green-bg text-tint-green-text border-tint-green-border font-semibold shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => updateFilter('timeframe', 'month')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border',
              timeframeFilter === 'month'
                ? 'bg-tint-green-bg text-tint-green-text border-tint-green-border font-semibold shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border-subtle rounded-card p-4 shadow-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              id="history-search"
              type="search"
              placeholder="Search history by task or note..."
              value={searchQuery}
              onChange={(e) => updateFilter('q', e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          {/* Branch Filter */}
          {showBranchFilter && (
            <div>
              <Select
                id="history-branch"
                value={branchFilter}
                onChange={(e) => updateFilter('branch', e.target.value)}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Team Filter */}
          <div>
            <Select
              id="history-team"
              value={teamFilter}
              onChange={(e) => updateFilter('team', e.target.value)}
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Priority Filter */}
          <div>
            <Select
              id="history-priority"
              value={priorityFilter}
              onChange={(e) => updateFilter('priority', e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal Priority</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Tasks Grid or Empty State */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <Spinner size="lg" className="text-brand-blue mb-3" />
          <p className="text-sm font-medium">Loading task history...</p>
        </div>
      ) : isError ? (
        <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 text-center text-sm text-tint-red-text">
          <p className="font-semibold mb-1">Unable to load task history</p>
          <p className="text-xs text-destructive mb-4">
            An error occurred while fetching completed tasks.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-subtle bg-surface/50 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-text-muted mx-auto flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            No completed tasks found
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4 leading-relaxed">
            When you or your team mark tasks as "Done", they are archived here with
            their completion history and will never be removed.
          </p>
          {(searchQuery || timeframeFilter !== 'all' || branchFilter !== 'all' || teamFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchParams(new URLSearchParams())
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
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
            itemName="completed tasks"
            onPageChange={(page) => updateFilter('page', String(page))}
          />
        </div>
      )}

      {/* Edit Sheet */}
      <TaskFormSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        taskToEdit={taskToEdit}
      />

      {/* Delete Dialog */}
      <TaskDeleteDialog
        isOpen={Boolean(taskToDelete)}
        task={taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
