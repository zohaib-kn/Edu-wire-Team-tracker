import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Clock, PlayCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useDashboardSummary } from '@/features/tasks/hooks/useDashboardSummary'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { useBranches, useTeams } from '@/features/tasks/hooks/useMetadata'
import { SummaryCards } from '@/features/tasks/components/SummaryCards'
import { TaskFilterBar } from '@/features/tasks/components/TaskFilterBar'
import { TaskCard } from '@/features/tasks/components/TaskCard'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { TaskDeleteDialog } from '@/features/tasks/components/TaskDeleteDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
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

  // Filter tasks into "In Progress" (doing) and "Pending" (todo)
  const allTasks = useMemo(() => tasksData?.tasks || [], [tasksData?.tasks])

  const inProgressTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'doing'),
    [allTasks],
  )

  const pendingTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'todo'),
    [allTasks],
  )

  return (
    <div className="space-y-6">
      {/* Dashboard Page Header */}
      <PageHeader
        title="Dashboard"
        description="Overview of your team's tasks and progress"
        actions={
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
              Refresh
            </Button>

            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreate}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Task
              </Button>
            )}
          </div>
        }
      />

      {/* Summary Metrics Strip */}
      <section aria-label="Task Summary Metrics">
        <SummaryCards
          summary={summary}
          isLoading={isSummaryLoading}
          isError={isSummaryError}
        />
      </section>

      {/* Branch & Team Filter Chips */}
      <section aria-label="Branch and Team Filters" className="pt-2">
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

      {/* Task Sections: In Progress & Pending */}
      {isTasksLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="lg" className="text-[#1D4ED8] mb-3" />
          <p className="text-sm">Loading tasks...</p>
        </div>
      ) : isTasksError ? (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-800">
          <p className="font-semibold mb-1">Unable to load tasks from server</p>
          <p className="text-xs text-red-600 mb-4">
            The tasks API endpoint is currently unreachable.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchTasks()}
          >
            Try Again
          </Button>
        </div>
      ) : (
        <div className="space-y-8 pt-2">
          {/* Section 1: In Progress (doing) */}
          <section aria-label="In Progress Tasks" className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-[#1D4ED8]" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                  In Progress
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] border border-blue-200">
                  {inProgressTasks.length}
                </span>
              </div>
            </div>

            {inProgressTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                No tasks currently in progress.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgressTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleOpenEdit}
                    onDelete={(t) => setTaskToDelete(t)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Pending (todo) */}
          <section aria-label="Pending Tasks" className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                  Pending Tasks
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {pendingTasks.length}
                </span>
              </div>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                No pending tasks found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleOpenEdit}
                    onDelete={(t) => setTaskToDelete(t)}
                  />
                ))}
              </div>
            )}
          </section>
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
