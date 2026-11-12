import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PanelRightOpen, X } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { useBranches, useTeams, useTeamMembers } from '@/features/tasks/hooks/useMetadata'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import {
  getWeekRange,
  getMonthMatrix,
  formatDateKey,
  addDays,
  addMonths,
} from '@/features/tasks/utils/dateUtils'
import { ScheduleToolbar } from '@/features/schedule/components/ScheduleToolbar'
import { MiniCalendar } from '@/features/schedule/components/MiniCalendar'
import { SelectedDaySummary } from '@/features/schedule/components/SelectedDaySummary'
import { DayView } from '@/features/schedule/components/DayView'
import { WeekView } from '@/features/schedule/components/WeekView'
import { MonthView } from '@/features/schedule/components/MonthView'
import { getTaskDetailNavState } from '@/features/tasks/utils/taskNavigation'
import type { Task, TaskStatus, TaskPriority } from '@/features/tasks/types/task.types'

export function SchedulePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // 1. Navigation & Calendar View State
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)

  // 2. Filters State
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedMember, setSelectedMember] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'all'>('all')
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'all'>('all')
  const [hideCompleted, setHideCompleted] = useState<boolean>(false)

  // 3. Metadata Loading
  const { data: branches = [] } = useBranches()
  const { data: allTeams = [] } = useTeams()
  const { data: teamMembers = [] } = useTeamMembers(selectedTeam !== 'all' ? selectedTeam : '')

  // Role permissions for filters
  const canFilterBranch = user?.role === 'Super Admin'
  const canFilterTeam =
    user?.role === 'Super Admin' ||
    user?.role === 'Branch Admin' ||
    (user?.role === 'Team Lead' && (user?.teams?.length || 0) > 1)

  // Filter teams by selected branch
  const filteredTeams = useMemo(() => {
    if (selectedBranch === 'all') return allTeams
    return allTeams.filter((t) => t.branchId === selectedBranch || t.branch === selectedBranch)
  }, [allTeams, selectedBranch])

  // 4. Compute Date Range for Server-Side Bounded Query
  const { startDate, endDate } = useMemo(() => {
    if (viewMode === 'day') {
      const dStr = formatDateKey(currentDate)
      return { startDate: dStr, endDate: dStr }
    }
    if (viewMode === 'week') {
      const range = getWeekRange(currentDate)
      return { startDate: range.startDateStr, endDate: range.endDateStr }
    }
    // Month view
    const matrix = getMonthMatrix(currentDate)
    return { startDate: matrix.startDateStr, endDate: matrix.endDateStr }
  }, [viewMode, currentDate])

  // 5. Fetch Tasks Bounded to the Active Calendar Window
  const {
    data: tasksResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useTasks({
    startDate,
    endDate,
    branch: selectedBranch !== 'all' ? selectedBranch : undefined,
    team: selectedTeam !== 'all' ? selectedTeam : undefined,
    owner: selectedMember !== 'all' ? selectedMember : undefined,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    priority: selectedPriority !== 'all' ? selectedPriority : undefined,
    limit: 400,
  })

  // Raw tasks from API response
  const fetchedTasks = tasksResponse?.tasks || []

  // 6. Filter tasks (e.g. hide completed, and exclude parent tasks from duplicating employee workload)
  const calendarTasks = useMemo(() => {
    return fetchedTasks.filter((task) => {
      // Exclude parent tasks so actionable subtasks represent the workload without double-counting
      if (task.taskLevel === 'parent') {
        return false
      }
      if (hideCompleted && task.status === 'done') {
        return false
      }
      return true
    })
  }, [fetchedTasks, hideCompleted])

  // Task dates set for MiniCalendar indicators
  const taskDatesSet = useMemo(() => {
    const set = new Set<string>()
    for (const t of calendarTasks) {
      if (t.due) {
        const d = t.due.includes('T') ? t.due.split('T')[0] : t.due
        set.add(d)
      }
    }
    return set
  }, [calendarTasks])

  // 7. Navigation Handlers
  const handlePrevDate = () => {
    if (viewMode === 'day') {
      setCurrentDate((prev) => addDays(prev, -1))
    } else if (viewMode === 'week') {
      setCurrentDate((prev) => addDays(prev, -7))
    } else {
      setCurrentDate((prev) => addMonths(prev, -1))
    }
  }

  const handleNextDate = () => {
    if (viewMode === 'day') {
      setCurrentDate((prev) => addDays(prev, 1))
    } else if (viewMode === 'week') {
      setCurrentDate((prev) => addDays(prev, 7))
    } else {
      setCurrentDate((prev) => addMonths(prev, 1))
    }
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
    if (viewMode === 'day') {
      setCurrentDate(date)
    }
  }

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${encodeURIComponent(task.id)}`, {
      state: getTaskDetailNavState(location),
    })
  }

  return (
    <div className="space-y-4">
      {/* Schedule Toolbar (Navigation, View Modes, Filters) */}
      <ScheduleToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentDate={currentDate}
        onPrevDate={handlePrevDate}
        onNextDate={handleNextDate}
        onToday={handleToday}
        onOpenCreateTask={() => setIsCreateOpen(true)}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        branches={branches}
        canFilterBranch={canFilterBranch}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        teams={filteredTeams}
        canFilterTeam={canFilterTeam}
        selectedMember={selectedMember}
        onMemberChange={setSelectedMember}
        teamMembers={teamMembers}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedPriority={selectedPriority}
        onPriorityChange={setSelectedPriority}
        hideCompleted={hideCompleted}
        onToggleHideCompleted={() => setHideCompleted((prev) => !prev)}
      />

      {/* Mobile Right-Panel Toggle Button */}
      <div className="lg:hidden flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMobilePanelOpen(true)}
          leftIcon={<PanelRightOpen className="w-4 h-4" />}
          className="text-xs"
        >
          View Day Summary & Mini-Cal
        </Button>
      </div>

      {/* Main Layout: Calendar Center & Right Panel */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Center: Main Calendar View */}
        <div className="flex-1 w-full min-w-0">
          {isLoading ? (
            <div className="h-96 rounded-xl border border-border-subtle bg-white flex flex-col items-center justify-center p-8 gap-3">
              <Spinner size="lg" />
              <p className="text-xs font-semibold text-slate-500">
                Loading schedule calendar...
              </p>
            </div>
          ) : isError ? (
            <Alert
              variant="error"
              title="Failed to load schedule"
              className="my-4"
            >
              <div className="space-y-2">
                <p>{(error as Error)?.message || 'Could not fetch tasks for this schedule.'}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </Alert>
          ) : viewMode === 'day' ? (
            <DayView currentDate={currentDate} tasks={calendarTasks} />
          ) : viewMode === 'week' ? (
            <WeekView
              currentDate={currentDate}
              tasks={calendarTasks}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          ) : (
            <MonthView
              currentDate={currentDate}
              tasks={calendarTasks}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onTaskClick={handleTaskClick}
            />
          )}
        </div>

        {/* Right Desktop Panel: Mini-Calendar & Selected Day Summary */}
        <div className="hidden lg:flex flex-col gap-4 w-80 shrink-0 sticky top-20">
          {/* Mini Calendar */}
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            taskDatesSet={taskDatesSet}
          />

          {/* Selected Day Task Summary */}
          <div className="p-4 bg-white rounded-xl border border-border-subtle shadow-xs h-[420px] flex flex-col">
            <SelectedDaySummary
              selectedDate={selectedDate}
              tasks={calendarTasks}
              onOpenCreateTask={() => setIsCreateOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer for Mini-Calendar & Day Summary */}
      {isMobilePanelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden flex justify-end"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobilePanelOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm h-full bg-white p-5 shadow-2xl flex flex-col overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                Date Selector & Day Summary
              </h3>
              <button
                type="button"
                onClick={() => setIsMobilePanelOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <MiniCalendar
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                handleSelectDate(d)
                setIsMobilePanelOpen(false)
              }}
              taskDatesSet={taskDatesSet}
            />

            <div className="flex-1 min-h-[300px]">
              <SelectedDaySummary
                selectedDate={selectedDate}
                tasks={calendarTasks}
                onOpenCreateTask={() => {
                  setIsMobilePanelOpen(false)
                  setIsCreateOpen(true)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Drawer */}
      <TaskFormSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  )
}
