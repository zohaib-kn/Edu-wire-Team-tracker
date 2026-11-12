import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  FolderOpen,
  Search,
  User,
  X,
} from 'lucide-react'
import { useTask } from '../hooks/useTask'
import { TaskStatusSelect } from './TaskStatusSelect'
import {
  formatDateOnly,
  formatDeadline,
  isTaskDueToday,
  isTaskOverdue,
} from '../utils/dateUtils'
import { cn } from '@/lib/utils/cn'
import { getTaskDetailNavState } from '../utils/taskNavigation'
import type { SubtaskItem, Task, TaskStatus } from '../types/task.types'

export interface ProjectTasksDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectTask: Task | null
  triggerRef?: RefObject<HTMLElement | null>
}

type DrawerStatusFilter = 'all' | TaskStatus

const STATUS_FILTER_OPTIONS: Array<{ key: DrawerStatusFilter; label: string }> = [
  { key: 'all', label: 'All Tasks' },
  { key: 'todo', label: 'To Do' },
  { key: 'doing', label: 'In Progress' },
  { key: 'done', label: 'Completed' },
]

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  )
}

function toSubtaskRowTask(sub: SubtaskItem, parent: Task): Task {
  return {
    id: sub.id,
    title: sub.title,
    note: sub.note,
    team: parent.team,
    teamId: parent.teamId,
    branch: parent.branch,
    branchId: parent.branchId,
    owner: sub.owner,
    ownerId: sub.ownerId,
    reportingManager: parent.reportingManager,
    reportingManagerId: parent.reportingManagerId,
    createdBy: parent.createdBy,
    createdById: parent.createdById,
    due: sub.due,
    deadlineAt: sub.deadlineAt,
    deadlineTimezone: sub.deadlineTimezone,
    reminderMinutesBefore: sub.reminderMinutesBefore,
    priority: sub.priority,
    status: sub.status,
    taskLevel: 'subtask',
    parentTask: parent.id,
    parentTaskId: parent.id,
    responsibilityLabel: sub.responsibilityLabel,
    isRequired: sub.isRequired,
    doneAt: sub.doneAt,
    createdAt: sub.createdAt,
  }
}

export function ProjectTasksDrawer({
  isOpen,
  onClose,
  projectTask,
  triggerRef,
}: ProjectTasksDrawerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const skipFocusRestoreRef = useRef(false)

  const [filterState, setFilterState] = useState<{
    taskId: string
    status: DrawerStatusFilter
    query: string
  }>({
    taskId: '',
    status: 'all',
    query: '',
  })

  const currentTaskId = projectTask?.id || ''
  const statusFilter: DrawerStatusFilter =
    filterState.taskId === currentTaskId ? filterState.status : 'all'
  const searchQuery =
    filterState.taskId === currentTaskId ? filterState.query : ''

  const setStatusFilter = (status: DrawerStatusFilter) => {
    setFilterState((prev) => ({
      taskId: currentTaskId,
      status,
      query: prev.taskId === currentTaskId ? prev.query : '',
    }))
  }

  const setSearchQuery = (query: string) => {
    setFilterState((prev) => ({
      taskId: currentTaskId,
      status: prev.taskId === currentTaskId ? prev.status : 'all',
      query,
    }))
  }

  // Keep task data live-synced with React Query while open
  const { data: liveTask, isFetching } = useTask(
    isOpen && projectTask ? projectTask.id : '',
  )
  const activeTask = liveTask ?? projectTask

  // Lock body scroll, contain focus, support Escape, and restore focus on close
  useEffect(() => {
    if (!isOpen) return undefined

    skipFocusRestoreRef.current = false
    const triggerEl = triggerRef?.current ?? null
    previousFocusRef.current =
      (triggerEl as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null)

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusables = getFocusableElements(panelRef.current)
        if (focusables.length === 0) {
          event.preventDefault()
          panelRef.current.focus()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (event.shiftKey) {
          if (!active || active === first || !panelRef.current.contains(active)) {
            event.preventDefault()
            last.focus()
          }
        } else if (!active || active === last || !panelRef.current.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeyDown)

      const returnTarget = triggerEl ?? previousFocusRef.current
      if (!skipFocusRestoreRef.current && returnTarget && returnTarget.isConnected) {
        window.requestAnimationFrame(() => {
          returnTarget.focus()
        })
      }
    }
  }, [isOpen, onClose, triggerRef])

  const subtasks = useMemo(() => activeTask?.subtasks || [], [activeTask?.subtasks])

  const statusCounts = useMemo(() => {
    let todo = 0
    let doing = 0
    let done = 0
    for (const sub of subtasks) {
      if (sub.status === 'done') done += 1
      else if (sub.status === 'doing') doing += 1
      else todo += 1
    }
    return { all: subtasks.length, todo, doing, done }
  }, [subtasks])

  const totalTasks = activeTask?.progress?.totalSubtasks ?? subtasks.length
  const completedTasks = activeTask?.progress?.completedSubtasks ?? statusCounts.done
  const progressPercentage =
    activeTask?.progress?.progressPercentage ??
    (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0)
  const hasPartialSubset = totalTasks > subtasks.length && !isFetching

  const filteredSubtasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return subtasks.filter((sub) => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) {
        return false
      }
      if (!query) return true
      const titleMatch = sub.title.toLowerCase().includes(query)
      const ownerMatch = sub.owner.toLowerCase().includes(query)
      const roleMatch = (sub.responsibilityLabel || '').toLowerCase().includes(query)
      return titleMatch || ownerMatch || roleMatch
    })
  }, [subtasks, statusFilter, searchQuery])

  if (!isOpen || !activeTask) return null

  const handleOpenTask = (taskId: string) => {
    skipFocusRestoreRef.current = true
    onClose()
    navigate(`/tasks/${encodeURIComponent(taskId)}`, {
      state: getTaskDetailNavState(location),
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-tasks-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Subtle Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right-Side Drawer Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex flex-col w-full sm:w-[520px] sm:max-w-[92vw] h-full bg-surface border-l border-border-subtle shadow-2xl overflow-hidden outline-none"
      >
        {/* Header */}
        <header className="border-b border-border-subtle px-4 py-4 sm:px-6 sm:py-5 shrink-0 bg-surface">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-medium text-brand-blue mb-1">
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {activeTask.team || 'Project Tasks'}
                  {activeTask.branch ? ` • ${activeTask.branch}` : ''}
                </span>
              </div>
              <h2
                id="project-tasks-drawer-title"
                className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-snug break-words"
              >
                {activeTask.title}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenTask(activeTask.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-nav text-xs font-medium text-text-muted hover:text-brand-blue hover:bg-brand-blue-light/60 border border-border-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
                title="Open full project details"
              >
                <span>Details</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close project tasks drawer"
                className="inline-flex items-center justify-center w-9 h-9 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-text-muted">
                <span className="font-semibold text-text-primary">{totalTasks}</span>{' '}
                {totalTasks === 1 ? 'Task' : 'Tasks'} ·{' '}
                <span className="font-semibold text-text-primary">{completedTasks}</span>{' '}
                Completed
              </span>
              <span className="font-semibold text-text-primary">
                Progress: {progressPercentage}%
              </span>
            </div>

            <div
              className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Project progress ${progressPercentage}%`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  progressPercentage === 100 ? 'bg-[#15803D]' : 'bg-brand-blue',
                )}
                style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
              />
            </div>

            {hasPartialSubset && (
              <p className="text-[11px] text-amber-700">
                Showing {subtasks.length} of {totalTasks} tasks loaded from the current view.{' '}
                <button
                  type="button"
                  onClick={() => handleOpenTask(activeTask.id)}
                  className="underline font-medium hover:text-amber-900 cursor-pointer"
                >
                  Open full project page
                </button>
              </p>
            )}
          </div>

          {/* Lightweight Filters & Search */}
          <div className="mt-4 space-y-2.5">
            <div
              role="group"
              aria-label="Filter tasks by status"
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
            >
              {STATUS_FILTER_OPTIONS.map((option) => {
                const count = statusCounts[option.key]
                const isSelected = statusFilter === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setStatusFilter(option.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-nav text-xs font-medium whitespace-nowrap border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer',
                      isSelected
                        ? 'bg-brand-blue-light text-brand-blue-text border-tint-blue-border font-semibold'
                        : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        'text-[11px] px-1.5 py-0.2 rounded-full',
                        isSelected
                          ? 'bg-surface text-brand-blue-text'
                          : 'bg-slate-100 text-text-muted',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {subtasks.length > 0 && (
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by task title, assignee, or role..."
                  aria-label="Search tasks in project"
                  className="w-full h-9 pl-9 pr-8 rounded-input border border-border-subtle bg-page text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:bg-surface focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear task search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Vertical Task List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filteredSubtasks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-text-primary">
                No matching tasks
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {subtasks.length === 0
                  ? 'This project currently has no assigned subtasks.'
                  : 'Try adjusting the status filter or search query.'}
              </p>
              {(statusFilter !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all')
                    setSearchQuery('')
                  }}
                  className="mt-3 inline-flex items-center px-3 py-1.5 rounded-nav text-xs font-semibold text-brand-blue hover:bg-brand-blue-light/60 transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filteredSubtasks.map((sub) => {
                const isDone = sub.status === 'done'
                const overdue = isTaskOverdue(sub.due, sub.status, sub.deadlineAt)
                const dueToday = isTaskDueToday(sub.due, sub.status, sub.deadlineAt)
                const subtaskTask = toSubtaskRowTask(sub, activeTask)

                const dateLabel = sub.deadlineAt
                  ? formatDeadline(sub.deadlineAt, sub.deadlineTimezone || 'Asia/Kolkata', sub.due)
                  : sub.due
                    ? formatDateOnly(sub.due)
                    : 'No due date'

                return (
                  <li
                    key={sub.id}
                    className="px-4 py-3.5 sm:px-6 hover:bg-slate-50/70 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_88px]"
                  >
                    <div className="flex flex-col gap-2.5">
                      {/* Title + Role + Priority */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={cn(
                                'text-sm font-semibold text-text-primary leading-snug break-words',
                                isDone && 'line-through text-text-muted',
                              )}
                            >
                              {sub.title}
                            </h3>
                            {sub.priority === 'high' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-tint-red-bg text-tint-red-text">
                                High
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Metadata + Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted min-w-0">
                          <span className="inline-flex items-center gap-1.5 text-text-primary font-medium min-w-0">
                            <User className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span className="truncate max-w-[160px]">{sub.owner}</span>
                          </span>

                          {sub.responsibilityLabel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium truncate max-w-[180px]">
                              {sub.responsibilityLabel}
                            </span>
                          )}

                          {isDone && sub.doneAt ? (
                            <span className="inline-flex items-center gap-1 text-tint-green-text font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                              <span>Done {formatDateOnly(sub.doneAt)}</span>
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1',
                                overdue && 'text-destructive font-semibold',
                                dueToday && !overdue && 'text-brand-blue font-semibold',
                              )}
                            >
                              {sub.deadlineAt ? (
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>{dateLabel}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          <TaskStatusSelect task={subtaskTask} size="sm" align="right" />

                          <button
                            type="button"
                            onClick={() => handleOpenTask(sub.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[30px] rounded-nav bg-surface hover:bg-slate-50 text-xs font-medium text-text-primary border border-border-subtle hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
                          >
                            <span>View Task</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

