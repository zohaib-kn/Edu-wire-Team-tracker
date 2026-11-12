import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  User,
  Edit2,
  Trash2,
  History,
  MessageCircle,
  Layers,
  Plus,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Bell,
  X,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTask } from '@/features/tasks/hooks/useTask'
import {
  useTaskDiscussionUnread,
  useMarkDiscussionAsRead,
} from '@/features/tasks/hooks/useTaskDiscussionUnread'
import { TaskStatusSelect } from '@/features/tasks/components/TaskStatusSelect'
import { TaskPriorityBadge } from '@/features/tasks/components/TaskPriorityBadge'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { TaskDeleteDialog } from '@/features/tasks/components/TaskDeleteDialog'
import { ActivityTimeline } from '@/features/tasks/components/ActivityTimeline'
import { TaskDiscussion } from '@/features/tasks/components/TaskDiscussion'
import { AddSubtaskDialog } from '@/features/tasks/components/AddSubtaskDialog'
import { SafeFormattedText } from '@/features/tasks/components/SafeFormattedText'
import {
  formatDateOnly,
  formatDeadline,
  isTaskOverdue,
  isTaskDueToday,
} from '@/features/tasks/utils/dateUtils'
import { canPerformTaskAction } from '@/features/tasks/utils/taskPermissions'
import {
  getTaskDetailNavState,
  getTaskDetailReturnTarget,
  type TaskDetailLocationState,
} from '@/features/tasks/utils/taskNavigation'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { Task } from '@/features/tasks/types/task.types'

type TabId = 'discussion' | 'activity'

interface TabDef {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabDef[] = [
  { id: 'discussion', label: 'Discussion', icon: MessageCircle },
  { id: 'activity', label: 'Activity', icon: History },
]

export interface TaskDetailWorkspaceProps {
  taskId: string
  isModal?: boolean
  onClose: () => void
  onSubDialogOpenChange?: (isOpen: boolean) => void
}

interface TaskPropertiesContentProps {
  task: Task
  isParent: boolean
  isSubtask: boolean
  parentId: string | null
  parentTitle: string | null
  navState: TaskDetailLocationState
  canChangeStatus: boolean
  overdue: boolean
  dueToday: boolean
  hideStatusRow?: boolean
  embedded?: boolean
}

function TaskPropertiesContent({
  task,
  isParent,
  isSubtask,
  parentId,
  parentTitle,
  navState,
  canChangeStatus,
  overdue,
  dueToday,
  hideStatusRow = false,
  embedded = false,
}: TaskPropertiesContentProps) {
  const rowClass =
    'grid grid-cols-[124px_minmax(0,1fr)] xl:grid-cols-[138px_minmax(0,1fr)] gap-4 py-2.5'
  const labelClass = 'text-[12.5px] font-medium text-text-muted leading-5'
  const valueClass = 'min-w-0 text-[13px] font-medium text-text-primary leading-5 break-words'
  const hasStatusCaption = isParent || !canChangeStatus

  return (
    <div
      className={cn(
        'bg-surface',
        !embedded && 'rounded-[12px] border border-border-subtle',
      )}
    >
      {!embedded && (
        <div className="px-5 py-3 border-b border-border-subtle">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Details
          </h3>
        </div>
      )}

      <dl
        className={cn(
          'divide-y divide-border-subtle/70',
          embedded ? 'py-1' : 'px-5 py-1',
        )}
      >
        {/* 1. Status */}
        {!hideStatusRow && (
          <div
            className={cn(
              rowClass,
              hasStatusCaption ? 'items-start' : 'items-center',
            )}
          >
            <dt className={cn(labelClass, hasStatusCaption && 'pt-[3px]')}>Status</dt>
            <dd className="min-w-0 space-y-1.5">
              <TaskStatusSelect task={task} size="md" align="right" />
              {isParent ? (
                <span className="block text-[11px] text-text-muted leading-4">
                  Derived from subtasks
                </span>
              ) : (
                !canChangeStatus && (
                  <span className="block text-[11px] text-text-muted leading-4">
                    Read-only
                  </span>
                )
              )}
            </dd>
          </div>
        )}

        {/* 2. Assigned To / Assignments */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>
            {isParent ? 'Assignments' : 'Assigned To'}
          </dt>
          <dd className={valueClass}>
            {isParent
              ? `${task.subtasks?.length || 0} Team Members`
              : task.owner || 'Unassigned'}
          </dd>
        </div>

        {/* Work Role (Subtasks / Assigned responsibilities) */}
        {task.responsibilityLabel && (
          <div className={cn(rowClass, 'items-baseline')}>
            <dt className={labelClass}>Work Role</dt>
            <dd className={valueClass}>
              {task.responsibilityLabel}
            </dd>
          </div>
        )}

        {/* Parent Task Link (Subtasks) */}
        {isSubtask && parentId && (
          <div className={cn(rowClass, 'items-baseline')}>
            <dt className={labelClass}>Parent Task</dt>
            <dd className="min-w-0 text-[13px] leading-5">
              <Link
                to={`/tasks/${encodeURIComponent(parentId)}`}
                state={navState}
                className="inline-flex items-center gap-1.5 font-medium text-brand-blue hover:underline break-words"
              >
                <span>{parentTitle || 'View Parent Task'}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              </Link>
            </dd>
          </div>
        )}

        {/* 3. Reporting Manager */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>Reporting Manager</dt>
          <dd className={valueClass}>
            {task.reportingManager || 'Standard Team Lead'}
          </dd>
        </div>

        {/* 4. Priority */}
        <div className={cn(rowClass, 'items-center')}>
          <dt className={labelClass}>Priority</dt>
          <dd className="min-w-0 flex items-center">
            <TaskPriorityBadge priority={task.priority} />
          </dd>
        </div>

        {/* 5. Due Date / Deadline */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>
            {task.deadlineAt
              ? isParent
                ? 'Overall Deadline'
                : 'Deadline'
              : isParent
                ? 'Overall Due Date'
                : 'Due Date'}
          </dt>
          <dd className="min-w-0 space-y-1.5">
            <div
              className={cn(
                'inline-flex items-start gap-2 text-[13px] font-medium leading-5 break-words',
                overdue
                  ? 'text-destructive font-semibold'
                  : dueToday
                    ? 'text-brand-blue font-semibold'
                    : 'text-text-primary',
              )}
            >
              {task.deadlineAt ? (
                <Clock className="w-3.5 h-3.5 shrink-0 mt-[3px] text-current" strokeWidth={1.75} />
              ) : (
                <Calendar className="w-3.5 h-3.5 shrink-0 mt-[3px] text-text-muted" strokeWidth={1.75} />
              )}
              <span>
                {task.deadlineAt
                  ? formatDeadline(
                    task.deadlineAt,
                    task.deadlineTimezone || 'Asia/Kolkata',
                    task.due,
                  )
                  : formatDateOnly(task.due)}
                {overdue && ' (Overdue)'}
                {dueToday && ' (Today)'}
              </span>
            </div>

            {task.reminderMinutesBefore && (
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted leading-4">
                <Bell className="w-3 h-3 shrink-0" />
                <span>Reminder: {task.reminderMinutesBefore}m before</span>
              </div>
            )}
          </dd>
        </div>

        {/* 6. Team */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>Team</dt>
          <dd className={valueClass}>
            {task.team || 'Unassigned Team'}
          </dd>
        </div>

        {/* 7. Branch */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>Branch</dt>
          <dd className={valueClass}>
            {task.branch || 'Headquarters / All'}
          </dd>
        </div>

        {/* 8. Created By */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>Created By</dt>
          <dd className={valueClass}>
            {task.createdBy || 'System'}
          </dd>
        </div>

        {/* 9. Created Date */}
        {task.createdAt && (
          <div className={cn(rowClass, 'items-baseline')}>
            <dt className={labelClass}>Created Date</dt>
            <dd className={valueClass}>
              {formatDateOnly(task.createdAt)}
            </dd>
          </div>
        )}

        {/* Completed Date (if done) */}
        {task.doneAt && (
          <div className={cn(rowClass, 'items-baseline font-medium text-tint-green-text')}>
            <dt className="text-[12.5px] font-medium leading-5">Completed</dt>
            <dd className="min-w-0 text-[13px] font-medium leading-5">{formatDateOnly(task.doneAt)}</dd>
          </div>
        )}

        {/* 10. Task ID */}
        <div className={cn(rowClass, 'items-baseline')}>
          <dt className={labelClass}>Task ID</dt>
          <dd
            className="font-mono text-[12px] text-text-primary font-medium leading-5 min-w-0 truncate"
            title={task.id}
          >
            {task.id}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function TaskDetailWorkspace({
  taskId,
  isModal = false,
  onClose,
  onSubDialogOpenChange,
}: TaskDetailWorkspaceProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const { data: task, isLoading, isError, refetch } = useTask(taskId)
  const { data: unreadData } = useTaskDiscussionUnread(taskId)
  const { mutate: markRead } = useMarkDiscussionAsRead(taskId)

  const tabParam: TabId = searchParams.get('tab') === 'activity' ? 'activity' : 'discussion'
  const tabSourceKey = `${taskId}:${tabParam}`
  const [tabSelection, setTabSelection] = useState<{ key: string; tab: TabId }>({
    key: tabSourceKey,
    tab: tabParam,
  })
  const activeTab: TabId =
    tabSelection.key === tabSourceKey ? tabSelection.tab : tabParam
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false)
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false)

  useEffect(() => {
    onSubDialogOpenChange?.(isEditOpen || isDeleteOpen || isAddSubtaskOpen)
  }, [isEditOpen, isDeleteOpen, isAddSubtaskOpen, onSubDialogOpenChange])

  const unreadCount = unreadData?.unreadCount ?? 0

  // Mark discussion as read when Discussion tab is active and unread messages exist
  useEffect(() => {
    if (activeTab === 'discussion' && taskId && unreadCount > 0) {
      markRead()
    }
  }, [activeTab, taskId, unreadCount, markRead])

  const navState = getTaskDetailNavState(location)
  const closeButton = isModal ? (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close task details"
      title="Close (Esc)"
      className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer shrink-0"
    >
      <X className="w-5 h-5" />
    </button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      onClick={onClose}
      leftIcon={<ArrowLeft className="w-[18px] h-[18px] text-text-muted" />}
      aria-label="Back to Dashboard"
      className="h-9 px-2.5 sm:px-3 gap-0 sm:gap-1.5"
    >
      <span className="hidden sm:inline">Back</span>
    </Button>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-surface">
        <header className="min-h-[64px] px-4 sm:px-6 lg:px-7 py-2.5 border-b border-border-subtle flex items-center justify-between gap-3 shrink-0 bg-surface">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-muted">Task Workspace</p>
            <h1 id="task-workspace-title" className="text-base font-semibold text-text-primary truncate">
              Loading task details...
            </h1>
          </div>
          {closeButton}
        </header>
        <div
          role="status"
          aria-live="polite"
          className="flex-1 py-24 flex flex-col items-center justify-center text-text-muted"
        >
          <Spinner size="lg" className="text-brand-blue mb-3" />
          <p className="text-sm font-medium">Loading task details...</p>
        </div>
      </div>
    )
  }

  if (isError || !task) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-surface">
        <header className="min-h-[64px] px-4 sm:px-6 lg:px-7 py-2.5 border-b border-border-subtle flex items-center justify-between gap-3 shrink-0 bg-surface">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-muted">Task Workspace</p>
            <h1 id="task-workspace-title" className="text-base font-semibold text-text-primary truncate">
              Task Not Found
            </h1>
          </div>
          {closeButton}
        </header>
        <div className="flex-1 p-6 sm:p-10 flex items-center justify-center">
          <div
            role="alert"
            className="rounded-[12px] border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 sm:p-12 text-center max-w-lg w-full"
          >
            <h2 className="text-base font-semibold text-tint-red-text mb-1">
              Task Not Found
            </h2>
            <p className="text-xs text-destructive mb-4">
              The requested task could not be loaded or has been removed.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
              {isModal ? (
                <Button variant="primary" size="sm" onClick={onClose}>
                  Close
                </Button>
              ) : (
                <Link to="/dashboard">
                  <Button variant="primary" size="sm">
                    Back to Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const canEdit = canPerformTaskAction(user, 'edit', task)
  const canDelete = canPerformTaskAction(user, 'delete', task)
  const canChangeStatus = canPerformTaskAction(user, 'status', task)
  const overdue = isTaskOverdue(task.due, task.status, task.deadlineAt)
  const dueToday = isTaskDueToday(task.due, task.status, task.deadlineAt)

  const isParent =
    task.taskLevel === 'parent' || Boolean(task.subtasks && task.subtasks.length > 0)
  const isSubtask = task.taskLevel === 'subtask' || Boolean(task.parentTask)

  const parentId = task.parentTask
    ? typeof task.parentTask === 'object'
      ? task.parentTask.id
      : task.parentTaskId || task.parentTask
    : null

  const parentTitle = task.parentTask
    ? typeof task.parentTask === 'object'
      ? task.parentTask.title
      : 'Parent Task'
    : null

  const dueSummaryLabel = task.deadlineAt
    ? formatDeadline(task.deadlineAt, task.deadlineTimezone || 'Asia/Kolkata', task.due)
    : formatDateOnly(task.due)

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-surface">
      {/* ── Fixed Compact Modal / Workspace Header ── */}
      <header
        className={cn(
          'min-h-[68px] px-5 sm:px-7 py-3.5 border-b border-border-subtle bg-surface flex items-center justify-between gap-4 shrink-0',
          !isModal && 'sticky top-0 z-20 rounded-t-[12px]',
        )}
      >
        {/* Left: Parent breadcrumb + Task Type/Context + Task Title */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs leading-5 text-text-muted min-w-0 mb-1.5">
            {isSubtask && parentId ? (
              <>
                <Link
                  to={`/tasks/${encodeURIComponent(parentId)}`}
                  state={navState}
                  className="inline-flex items-center gap-1.5 font-medium text-brand-blue hover:underline min-w-0 max-w-[160px] sm:max-w-[320px]"
                  title={parentTitle || 'View Parent Task'}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{parentTitle}</span>
                </Link>
                <span className="text-slate-300 select-none shrink-0">/</span>
                <span className="font-medium text-text-muted shrink-0">Subtask</span>
              </>
            ) : isParent ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-brand-blue shrink-0">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Parent Task</span>
              </span>
            ) : (
              <span className="font-medium text-text-muted shrink-0">Task</span>
            )}

            {task.team && (
              <>
                <span className="text-slate-300 select-none shrink-0">·</span>
                <span className="truncate min-w-0 max-w-[110px] sm:max-w-[220px]">
                  {task.team}
                </span>
              </>
            )}

            {task.responsibilityLabel && (
              <>
                <span className="hidden md:inline text-slate-300 select-none shrink-0">
                  ·
                </span>
                <span className="hidden md:inline truncate max-w-[200px] text-slate-600 font-medium">
                  {task.responsibilityLabel}
                </span>
              </>
            )}
          </div>

          <h1
            id="task-workspace-title"
            className="text-[17px] sm:text-[18px] font-semibold text-text-primary leading-6 tracking-[-0.01em] line-clamp-2 sm:line-clamp-1 break-words"
            title={task.title}
          >
            {task.title}
          </h1>
        </div>

        {/* Right: Actions + Back/Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isParent && canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddSubtaskOpen(true)}
              leftIcon={<Plus className="w-[18px] h-[18px] text-text-muted" />}
              aria-label="Add Subtask"
              title="Add Subtask"
              className="h-9 px-2.5 md:px-3 gap-0 md:gap-1.5"
            >
              <span className="hidden md:inline">Add Subtask</span>
            </Button>
          )}

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              leftIcon={<Edit2 className="w-[18px] h-[18px] text-text-muted" />}
              aria-label="Edit Task"
              title="Edit Task"
              className="h-9 px-2.5 sm:px-3 gap-0 sm:gap-1.5"
            >
              <span className="hidden sm:inline">Edit Task</span>
            </Button>
          )}

          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
              leftIcon={<Trash2 className="w-[18px] h-[18px]" />}
              aria-label="Delete Task"
              title="Delete Task"
              className="h-9 px-2.5 sm:px-3 gap-0 sm:gap-1.5"
            >
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}

          {isModal && (
            <span
              className="hidden sm:block h-5 w-px bg-border-subtle mx-0.5"
              aria-hidden="true"
            />
          )}

          {closeButton}
        </div>
      </header>

      {/* ── Scrollable Workspace Body ── */}
      <div
        className={cn(
          'flex-1 min-w-0',
          isModal && 'min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain',
        )}
      >
        <div className="px-5 py-5 sm:px-7 sm:py-5 min-w-0">
          {/* Mobile & Tablet (< lg): Status bar + Accessible Collapsible Details */}
          <div className="lg:hidden mb-6 rounded-[12px] border border-border-subtle bg-surface">
            <div className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <TaskStatusSelect task={task} size="md" align="left" />
                  <TaskPriorityBadge priority={task.priority} />
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium leading-5',
                    overdue
                      ? 'text-destructive font-semibold'
                      : dueToday
                        ? 'text-brand-blue font-semibold'
                        : 'text-text-muted',
                  )}
                >
                  {task.deadlineAt ? (
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{dueSummaryLabel}</span>
                </span>
              </div>

              <button
                type="button"
                aria-expanded={isMobileDetailsOpen}
                aria-controls="mobile-task-details-panel"
                onClick={() => setIsMobileDetailsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-text-primary bg-slate-50 hover:bg-slate-100 border border-border-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer shrink-0"
              >
                <span>Details</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-text-muted transition-transform duration-150',
                    isMobileDetailsOpen && 'rotate-180',
                  )}
                />
              </button>
            </div>

            {isMobileDetailsOpen && (
              <div
                id="mobile-task-details-panel"
                className="px-4 pb-3 pt-1 border-t border-border-subtle"
              >
                <TaskPropertiesContent
                  task={task}
                  isParent={isParent}
                  isSubtask={isSubtask}
                  parentId={parentId}
                  parentTitle={parentTitle}
                  navState={navState}
                  canChangeStatus={canChangeStatus}
                  overdue={overdue}
                  dueToday={dueToday}
                  hideStatusRow
                  embedded
                />
              </div>
            )}
          </div>

          {/* Main Desktop Two-Column Split */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,63fr)_minmax(0,37fr)] gap-6 lg:gap-8 xl:gap-9 items-start min-w-0">
            {/* ── LEFT COLUMN: Description, Subtasks, Discussion & Activity ── */}
            <div className="min-w-0 space-y-6 sm:space-y-7">
              {/* Description */}
              <section aria-labelledby="task-description-heading">
                <h2
                  id="task-description-heading"
                  className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3"
                >
                  Description
                </h2>
                {task.note ? (
                  <div className="rounded-[12px] border border-border-subtle bg-slate-50/60 p-4 text-[13.5px] text-text-primary whitespace-pre-wrap leading-relaxed break-words">
                    <SafeFormattedText text={task.note} />
                  </div>
                ) : (
                  <p className="text-[13px] text-text-muted italic leading-6 py-0.5">
                    No description provided.
                  </p>
                )}
              </section>

              {/* Individual Assignments / Subtasks (Parent Tasks Only) */}
              {isParent && (
                <section
                  aria-labelledby="task-subtasks-heading"
                  className="pt-6 sm:pt-7 border-t border-border-subtle space-y-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2
                        id="task-subtasks-heading"
                        className="text-sm font-semibold text-text-primary flex items-center gap-2"
                      >
                        <span>Individual Assignments</span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 tabular-nums">
                          {task.subtasks?.length || 0}
                        </span>
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        Employees independently responsible for specific deliverables.
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddSubtaskOpen(true)}
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Add Member
                      </Button>
                    )}
                  </div>

                  {/* Backend-derived overall progress bar */}
                  {task.progress && (
                    <div className="rounded-[10px] border border-border-subtle bg-slate-50/60 px-3.5 py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-text-muted">
                          <span className="font-semibold text-text-primary tabular-nums">
                            {task.progress.completedRequiredSubtasks} / {task.progress.requiredSubtasks}
                          </span>{' '}
                          required completed ·{' '}
                          <span className="tabular-nums">{task.progress.pendingSubtasks}</span> pending
                        </span>
                        <span className="font-semibold text-text-primary tabular-nums">
                          {task.progress.progressPercentage}%
                        </span>
                      </div>
                      <div
                        className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={task.progress.progressPercentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Overall progress ${task.progress.progressPercentage}%`}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            task.progress.progressPercentage === 100
                              ? 'bg-[#15803D]'
                              : 'bg-brand-blue',
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(0, task.progress.progressPercentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {task.subtasks && task.subtasks.length > 0 ? (
                    <div className="rounded-[10px] border border-border-subtle divide-y divide-border-subtle bg-surface">
                      {task.subtasks.map((st) => {
                        const subOverdue = isTaskOverdue(st.due, st.status, st.deadlineAt)
                        const subDueToday = isTaskDueToday(st.due, st.status, st.deadlineAt)

                        return (
                          <div
                            key={st.id}
                            className="p-3 sm:px-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  to={`/tasks/${encodeURIComponent(st.id)}`}
                                  state={navState}
                                  className="font-semibold text-sm text-text-primary hover:text-brand-blue hover:underline break-words"
                                >
                                  {st.title}
                                </Link>
                                {st.responsibilityLabel && (
                                  <span className="text-xs text-text-muted">
                                    — {st.responsibilityLabel}
                                  </span>
                                )}
                                {!st.isRequired && (
                                  <span className="text-[11px] text-text-muted bg-slate-100 rounded-[6px] px-1.5 py-0.5">
                                    Optional
                                  </span>
                                )}
                              </div>

                              {st.note && (
                                <p className="text-xs text-text-muted line-clamp-1">
                                  {st.note}
                                </p>
                              )}

                              <div className="flex items-center gap-x-3 gap-y-1 text-xs text-text-muted flex-wrap">
                                <div className="flex items-center gap-1 font-medium text-text-primary">
                                  <User className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                  <span>{st.owner}</span>
                                </div>
                                {(st.deadlineAt || st.due) && (
                                  <div
                                    className={cn(
                                      'flex items-center gap-1',
                                      subOverdue && 'text-destructive font-semibold',
                                      subDueToday && !subOverdue && 'text-brand-blue font-semibold',
                                    )}
                                  >
                                    {st.deadlineAt ? (
                                      <>
                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                          {formatDeadline(
                                            st.deadlineAt,
                                            st.deadlineTimezone || 'Asia/Kolkata',
                                            st.due,
                                          )}
                                          {subOverdue && ' (Overdue)'}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                          {formatDateOnly(st.due)}
                                          {subOverdue && ' (Overdue)'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                                {st.reminderMinutesBefore && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                                    <Bell className="w-3 h-3 shrink-0" />
                                    <span>{st.reminderMinutesBefore}m before</span>
                                  </span>
                                )}
                                {st.doneAt && (
                                  <div className="flex items-center gap-1 text-tint-green-text font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                                    <span>Done on {formatDateOnly(st.doneAt)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <TaskStatusSelect
                                task={{
                                  id: st.id,
                                  title: st.title,
                                  status: st.status,
                                  priority: st.priority,
                                  due: st.due,
                                  deadlineAt: st.deadlineAt,
                                  deadlineTimezone: st.deadlineTimezone,
                                  doneAt: st.doneAt,
                                  team: task.team,
                                  teamId: task.teamId,
                                  branch: task.branch,
                                  branchId: task.branchId,
                                  owner: st.owner,
                                  ownerId: st.ownerId,
                                  createdBy: task.createdBy,
                                  createdById: task.createdById,
                                  reportingManager: task.reportingManager,
                                  taskLevel: 'subtask',
                                }}
                                size="sm"
                                align="right"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate(`/tasks/${encodeURIComponent(st.id)}`, {
                                    state: navState,
                                  })
                                }
                                leftIcon={<ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-5 px-4 text-center bg-slate-50/70 border border-dashed border-border-subtle rounded-[10px] text-xs text-text-muted space-y-2.5">
                      <p>No individual assignments yet.</p>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddSubtaskOpen(true)}
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Add First Member Assignment
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Discussion & Activity History Section */}
              <section
                aria-label="Discussion and Activity History"
                className="pt-6 sm:pt-7 border-t border-border-subtle"
              >
                <div
                  className="flex items-center gap-6 border-b border-border-subtle"
                  role="tablist"
                  aria-label="Task discussion and activity"
                >
                  {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    const showBadge = tab.id === 'discussion' && unreadCount > 0

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`tabpanel-${tab.id}`}
                        id={`tab-${tab.id}`}
                        onClick={() => {
                          setTabSelection({ key: tabSourceKey, tab: tab.id })
                          if (tab.id === 'discussion' && unreadCount > 0) {
                            markRead()
                          }
                        }}
                        className={cn(
                          'inline-flex items-center gap-2 px-0.5 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-t-[6px]',
                          isActive
                            ? 'border-brand-blue text-brand-blue'
                            : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-subtle',
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>
                          {tab.id === 'discussion' && isParent
                            ? 'Project Discussion'
                            : tab.label}
                        </span>
                        {showBadge && (
                          <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-semibold bg-brand-blue text-white rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-5">
                  <div
                    role="tabpanel"
                    id="tabpanel-discussion"
                    aria-labelledby="tab-discussion"
                    hidden={activeTab !== 'discussion'}
                  >
                    {activeTab === 'discussion' && (
                      <TaskDiscussion
                        taskId={task.id}
                        taskIsDone={task.status === 'done'}
                      />
                    )}
                  </div>

                  <div
                    role="tabpanel"
                    id="tabpanel-activity"
                    aria-labelledby="tab-activity"
                    hidden={activeTab !== 'activity'}
                  >
                    {activeTab === 'activity' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-text-muted" />
                          <h3 className="font-semibold text-text-primary text-xs uppercase tracking-wider">
                            Activity History
                          </h3>
                        </div>
                        <ActivityTimeline activities={task.activity} />
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* ── RIGHT COLUMN (~35%): Sticky Properties & Metadata (Desktop) ── */}
            <aside
              aria-label="Task properties and metadata"
              className={cn(
                'hidden lg:block min-w-0',
                isModal
                  ? 'lg:sticky lg:top-0 lg:max-h-[calc(min(90vh,920px)-96px)] lg:overflow-y-auto'
                  : 'lg:sticky lg:top-6',
              )}
            >
              <TaskPropertiesContent
                task={task}
                isParent={isParent}
                isSubtask={isSubtask}
                parentId={parentId}
                parentTitle={parentTitle}
                navState={navState}
                canChangeStatus={canChangeStatus}
                overdue={overdue}
                dueToday={dueToday}
              />
            </aside>
          </div>
        </div>
      </div>

      {/* Edit Task Sheet */}
      <TaskFormSheet
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        taskToEdit={task}
      />

      {/* Add Subtask Dialog (Parent Tasks) */}
      {isParent && (
        <AddSubtaskDialog
          isOpen={isAddSubtaskOpen}
          onClose={() => setIsAddSubtaskOpen(false)}
          parentTask={task}
        />
      )}

      {/* Delete Confirmation Modal */}
      <TaskDeleteDialog
        isOpen={isDeleteOpen}
        task={task}
        onClose={() => setIsDeleteOpen(false)}
        onSuccess={() => {
          navigate(
            isModal ? getTaskDetailReturnTarget(location, '/dashboard') : '/dashboard',
            { replace: true },
          )
        }}
      />
    </div>
  )
}

