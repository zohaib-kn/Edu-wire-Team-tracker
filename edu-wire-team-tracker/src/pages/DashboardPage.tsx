import { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Plus,
  RefreshCw,
  Columns3,
  Circle,
  Hourglass,
  CheckCircle2,
  ArrowUpRight,
  Inbox,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useDashboardSummary } from '@/features/tasks/hooks/useDashboardSummary'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { useBranches, useTeams } from '@/features/tasks/hooks/useMetadata'
import { SummaryCards } from '@/features/tasks/components/SummaryCards'
import { TaskFilterBar } from '@/features/tasks/components/TaskFilterBar'
import { TaskCard } from '@/features/tasks/components/TaskCard'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { TaskDeleteDialog } from '@/features/tasks/components/TaskDeleteDialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { usePageHeader } from '@/context/HeaderContext'
import { canPerformTaskAction } from '@/features/tasks/utils/taskPermissions'
import type { Task } from '@/features/tasks/types/task.types'

export function DashboardPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filter state from URL search params
  const branchFilter = searchParams.get('branch') || 'all'
  const teamFilter = searchParams.get('team') || 'all'

  // Metadata queries
  const { data: branches = [] } = useBranches()
  const { data: teams = [] } = useTeams()

  // Summary query with filters
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useDashboardSummary({
    branch: branchFilter,
    team: teamFilter,
  })

  // Tasks query
  const {
    data: tasksData,
    isLoading: isTasksLoading,
    isError: isTasksError,
    refetch: refetchTasks,
  } = useTasks({
    branch: branchFilter,
    team: teamFilter,
  })

  // Sheet & Dialog state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const canCreate = canPerformTaskAction(user, 'create')
  // Show branch filter if user is Super Admin or has multiple branches available
  const showBranchFilter = user?.role === 'Super Admin' || branches.length > 1

  const handleBranchChange = (newBranch: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newBranch === 'all') {
        next.delete('branch')
      } else {
        next.set('branch', newBranch)
      }
      return next
    })
  }

  const handleTeamChange = (newTeam: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newTeam === 'all') {
        next.delete('team')
      } else {
        next.set('team', newTeam)
      }
      return next
    })
  }

  const handleOpenCreate = () => {
    setTaskToEdit(null)
    setIsSheetOpen(true)
  }

  const handleOpenEdit = (task: Task) => {
    setTaskToEdit(task)
    setIsSheetOpen(true)
  }

  // Filter tasks into columns
  const allTasks = useMemo(() => tasksData?.tasks || [], [tasksData?.tasks])

  const todoTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'todo'),
    [allTasks],
  )

  const inProgressTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'doing'),
    [allTasks],
  )

  const completedTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'done'),
    [allTasks],
  )

  // Configure Top Header via usePageHeader
  usePageHeader({
    title: 'Dashboard',
    subtitle: "Overview of your team's tasks and progress",
    actions: (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchSummary()
            refetchTasks()
          }}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          aria-label="Refresh dashboard data"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Create Task</span>
          </Button>
        )}
      </div>
    ),
  })

  return (
    <div className="space-y-5">
      {/* 1. Summary Metrics Strip */}
      <section aria-label="Task Summary Metrics">
        <SummaryCards
          summary={summary}
          isLoading={isSummaryLoading}
          isError={isSummaryError}
        />
      </section>

      {/* 2. Branch & Team Filter Dropdowns */}
      <section aria-label="Branch and Team Filters">
        <TaskFilterBar
          selectedBranch={branchFilter}
          onBranchChange={handleBranchChange}
          selectedTeam={teamFilter}
          onTeamChange={handleTeamChange}
          branches={branches}
          teams={teams}
          showBranchFilter={showBranchFilter}
        />
      </section>

      {/* 3. Section Heading */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Columns3 className="w-5 h-5 text-text-primary" strokeWidth={1.75} />
          <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
            Tasks by Status
          </h2>
        </div>

        <Link
          to="/history"
          className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-nav hover:bg-brand-blue-light"
        >
          <span>Full History Archive</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 4. 3-Column Kanban Board */}
      {isTasksLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <Spinner size="lg" className="text-brand-blue mb-3" />
          <p className="text-sm font-medium">Loading tasks...</p>
        </div>
      ) : isTasksError ? (
        <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 text-center text-sm text-tint-red-text">
          <p className="font-semibold mb-1">Unable to load tasks from server</p>
          <p className="text-xs text-destructive mb-4">
            The tasks API endpoint is currently unreachable.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchTasks()}>
            Try Again
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Column 1: To Do */}
          <div className="rounded-card bg-tint-blue-bg/35 border border-tint-blue-border/70 p-4 sm:p-4.5 flex flex-col min-h-[460px]">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-tint-blue-border/60">
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-brand-blue" strokeWidth={2} />
                <h3 className="font-bold text-sm text-text-primary tracking-tight">
                  To Do
                </h3>
              </div>
              <span className="w-7 h-7 rounded-full bg-surface text-brand-blue font-bold text-xs flex items-center justify-center border border-tint-blue-border shadow-xs">
                {todoTasks.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex flex-col gap-3 flex-1">
              {todoTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-inner border border-dashed border-tint-blue-border/70 bg-surface/40">
                  <Inbox className="w-6 h-6 text-text-muted/60 mb-2" strokeWidth={1.5} />
                  <p className="text-xs font-semibold text-text-muted">No tasks to do</p>
                </div>
              ) : (
                todoTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleOpenEdit}
                    onDelete={(t) => setTaskToDelete(t)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="rounded-card bg-tint-amber-bg/35 border border-tint-amber-border/70 p-4 sm:p-4.5 flex flex-col min-h-[460px]">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-tint-amber-border/60">
              <div className="flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-amber-600" strokeWidth={2} />
                <h3 className="font-bold text-sm text-text-primary tracking-tight">
                  In Progress
                </h3>
              </div>
              <span className="w-7 h-7 rounded-full bg-surface text-amber-700 font-bold text-xs flex items-center justify-center border border-tint-amber-border shadow-xs">
                {inProgressTasks.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex flex-col gap-3 flex-1">
              {inProgressTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-inner border border-dashed border-tint-amber-border/70 bg-surface/40">
                  <Inbox className="w-6 h-6 text-text-muted/60 mb-2" strokeWidth={1.5} />
                  <p className="text-xs font-semibold text-text-muted">No tasks in progress</p>
                </div>
              ) : (
                inProgressTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleOpenEdit}
                    onDelete={(t) => setTaskToDelete(t)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="rounded-card bg-tint-green-bg/35 border border-tint-green-border/70 p-4 sm:p-4.5 flex flex-col min-h-[460px]">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-tint-green-border/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#15803D]" strokeWidth={2} />
                <h3 className="font-bold text-sm text-text-primary tracking-tight">
                  Completed
                </h3>
              </div>
              <span className="w-7 h-7 rounded-full bg-surface text-green-700 font-bold text-xs flex items-center justify-center border border-tint-green-border shadow-xs">
                {completedTasks.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex flex-col gap-3 flex-1">
              {completedTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-inner border border-dashed border-tint-green-border/70 bg-surface/40">
                  <Inbox className="w-6 h-6 text-text-muted/60 mb-2" strokeWidth={1.5} />
                  <p className="text-xs font-semibold text-text-muted">No completed tasks</p>
                </div>
              ) : (
                completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleOpenEdit}
                    onDelete={(t) => setTaskToDelete(t)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Create / Edit Drawer */}
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
        onSuccess={() => {
          refetchTasks()
          refetchSummary()
        }}
      />
    </div>
  )
}
