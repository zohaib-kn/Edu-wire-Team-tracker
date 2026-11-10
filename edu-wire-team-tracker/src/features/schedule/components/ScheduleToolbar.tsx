import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  EyeOff,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import {
  formatMonthYear,
  formatWeekRangeHeader,
  formatDayHeaderLong,
  getWeekRange,
} from '@/features/tasks/utils/dateUtils'
import type { BranchOption, TeamOption, TeamMemberOption, TaskStatus, TaskPriority } from '@/features/tasks/types/task.types'

export interface ScheduleToolbarProps {
  viewMode: 'day' | 'week' | 'month'
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void
  currentDate: Date
  onPrevDate: () => void
  onNextDate: () => void
  onToday: () => void
  onOpenCreateTask: () => void

  // Filters
  selectedBranch: string
  onBranchChange: (b: string) => void
  branches: BranchOption[]
  canFilterBranch: boolean

  selectedTeam: string
  onTeamChange: (t: string) => void
  teams: TeamOption[]
  canFilterTeam: boolean

  selectedMember: string
  onMemberChange: (m: string) => void
  teamMembers: TeamMemberOption[]

  selectedStatus: TaskStatus | 'all'
  onStatusChange: (s: TaskStatus | 'all') => void

  selectedPriority: TaskPriority | 'all'
  onPriorityChange: (p: TaskPriority | 'all') => void

  hideCompleted: boolean
  onToggleHideCompleted: () => void

  className?: string
}

export function ScheduleToolbar({
  viewMode,
  onViewModeChange,
  currentDate,
  onPrevDate,
  onNextDate,
  onToday,
  onOpenCreateTask,
  selectedBranch,
  onBranchChange,
  branches,
  canFilterBranch,
  selectedTeam,
  onTeamChange,
  teams,
  canFilterTeam,
  selectedMember,
  onMemberChange,
  teamMembers,
  selectedStatus,
  onStatusChange,
  selectedPriority,
  onPriorityChange,
  hideCompleted,
  onToggleHideCompleted,
  className,
}: ScheduleToolbarProps) {
  // Title text depending on view mode
  const titleText = (() => {
    if (viewMode === 'day') {
      return formatDayHeaderLong(currentDate)
    }
    if (viewMode === 'week') {
      const range = getWeekRange(currentDate)
      return formatWeekRangeHeader(range.start, range.end)
    }
    return formatMonthYear(currentDate)
  })()

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-border-subtle p-3.5 shadow-xs space-y-3',
        className,
      )}
    >
      {/* Row 1: Date Navigation, View Mode Switcher & + New Task Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Navigation & Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 border border-border-subtle rounded-lg p-0.5 bg-slate-50/80">
            <button
              type="button"
              onClick={onPrevDate}
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={onNextDate}
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-900 tracking-tight ml-1">
            {titleText}
          </h2>
        </div>

        {/* View Mode Switcher & Create Task */}
        <div className="flex items-center gap-2">
          {/* Day / Week / Month Pill Tabs */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200/80">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all cursor-pointer',
                  viewMode === mode
                    ? 'bg-white text-brand-blue shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onOpenCreateTask}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-xs"
          >
            New Task
          </Button>
        </div>
      </div>

      {/* Row 2: Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-medium mr-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Branch Filter (Admin only) */}
        {canFilterBranch && branches.length > 0 && (
          <select
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        {/* Team Filter */}
        {canFilterTeam && teams.length > 0 && (
          <select
            value={selectedTeam}
            onChange={(e) => onTeamChange(e.target.value)}
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="all">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {/* Member Filter (if team has members) */}
        {teamMembers.length > 0 && (
          <select
            value={selectedMember}
            onChange={(e) => onMemberChange(e.target.value)}
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="all">All Assignees</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.name || m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as any)}
          className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="doing">In Progress</option>
          <option value="done">Completed</option>
        </select>

        {/* Priority Filter */}
        <select
          value={selectedPriority}
          onChange={(e) => onPriorityChange(e.target.value as any)}
          className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          <option value="all">All Priority</option>
          <option value="high">High Priority</option>
          <option value="normal">Normal Priority</option>
        </select>

        {/* Hide Completed Tasks Toggle */}
        <button
          type="button"
          onClick={onToggleHideCompleted}
          className={cn(
            'h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ml-auto',
            hideCompleted
              ? 'bg-blue-50 border-brand-blue text-brand-blue font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          {hideCompleted ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Completed Hidden</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Show Completed</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
