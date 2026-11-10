import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  User,
  Users,
  Building2,
  Edit2,
  Trash2,
  History,
  ShieldCheck,
  MessageCircle,
  Layers,
  Plus,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Bell,
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
import {
  formatDateOnly,
  formatDeadline,
  isTaskOverdue,
  isTaskDueToday,
} from '@/features/tasks/utils/dateUtils'
import { canPerformTaskAction } from '@/features/tasks/utils/taskPermissions'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { usePageHeader } from '@/context/HeaderContext'

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

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const { data: task, isLoading, isError, refetch } = useTask(id || '')
  const { data: unreadData } = useTaskDiscussionUnread(id || '')
  const { mutate: markRead } = useMarkDiscussionAsRead(id || '')

  const initialTab = searchParams.get('tab') === 'activity' ? 'activity' : 'discussion'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false)

  const unreadCount = unreadData?.unreadCount ?? 0

  // Mark discussion as read when Discussion tab is active and unread messages exist
  useEffect(() => {
    if (activeTab === 'discussion' && id && unreadCount > 0) {
      markRead()
    }
  }, [activeTab, id, unreadCount, markRead])

  const canEdit = canPerformTaskAction(user, 'edit', task)
  const canDelete = canPerformTaskAction(user, 'delete', task)
  const overdue = task ? isTaskOverdue(task.due, task.status, task.deadlineAt) : false
  const dueToday = task ? isTaskDueToday(task.due, task.status, task.deadlineAt) : false

  const isParent = task?.taskLevel === 'parent' || Boolean(task?.subtasks && task.subtasks.length > 0)
  const isSubtask = task?.taskLevel === 'subtask' || Boolean(task?.parentTask)

  const parentId = task?.parentTask
    ? typeof task.parentTask === 'object'
      ? task.parentTask.id
      : task.parentTaskId || task.parentTask
    : null

  const parentTitle = task?.parentTask
    ? typeof task.parentTask === 'object'
      ? task.parentTask.title
      : 'Parent Task'
    : null

  // Connect actions to Header.tsx
  usePageHeader({
    title: task ? task.title : 'Task Details',
    subtitle: task
      ? `${isParent ? 'Parent Task' : isSubtask ? 'Subtask' : 'Task'} • ${task.team || 'General'}`
      : 'Task details and activity history',
    actions: (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          aria-label="Back"
        >
          <span className="hidden sm:inline">Back</span>
        </Button>

        {isParent && canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddSubtaskOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5 text-text-muted" />}
          >
            <span className="hidden sm:inline">Add Subtask</span>
          </Button>
        )}

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            leftIcon={<Edit2 className="w-3.5 h-3.5 text-text-muted" />}
            aria-label="Edit Task"
          >
            <span className="hidden sm:inline">Edit Task</span>
          </Button>
        )}

        {canDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            aria-label="Delete Task"
          >
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}
      </div>
    ),
  })

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-text-muted">
        <Spinner size="lg" className="text-brand-blue mb-3" />
        <p className="text-sm font-medium">Loading task details...</p>
      </div>
    )
  }

  if (isError || !task) {
    return (
      <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-12 text-center max-w-lg mx-auto">
        <h3 className="text-base font-semibold text-tint-red-text mb-1">
          Task Not Found
        </h3>
        <p className="text-xs text-destructive mb-4">
          The requested task could not be loaded or has been removed.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
          <Link to="/dashboard">
            <Button variant="primary" size="sm">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Subtask Breadcrumb Banner ── */}
      {isSubtask && parentId && (
        <div className="p-3 bg-slate-50/90 border border-slate-200/80 rounded-inner flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-text-muted">Part of Parent Task:</span>
            <Link
              to={`/tasks/${encodeURIComponent(parentId)}`}
              className="font-semibold text-brand-blue hover:underline truncate flex items-center gap-1"
            >
              <span>{parentTitle}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          </div>
          <Link
            to={`/tasks/${encodeURIComponent(parentId)}`}
            className="text-[11px] font-medium text-text-muted hover:text-text-primary shrink-0"
          >
            View Parent Task &rarr;
          </Link>
        </div>
      )}

      {/* Main Grid: Details (Left) + Right Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column: Task Header, Properties & Subtasks ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-card border border-border-subtle">
            <CardContent className="p-6 space-y-6">
              {/* Status and Priority Meta */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-4 border-b border-border-subtle/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-medium">Status:</span>
                  <TaskStatusSelect task={task} size="md" />
                </div>
                <div className="flex items-center gap-2">
                  {isParent && (
                    <span className="text-[11px] font-semibold text-brand-blue bg-tint-blue-bg border border-tint-blue-border px-2 py-0.5 rounded-badge">
                      Parent Task
                    </span>
                  )}
                  <span className="text-xs text-text-muted font-medium">Priority:</span>
                  <TaskPriorityBadge priority={task.priority} />
                </div>
              </div>

              {/* Task Title & Optional Responsibility */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight">
                    {task.title}
                  </h1>
                  {task.responsibilityLabel && (
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded-badge px-2.5 py-1 border border-slate-200">
                      Work Role: {task.responsibilityLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  {isParent ? 'Overall Project Description / Notes' : 'Notes & Details'}
                </h4>
                {task.note ? (
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed bg-slate-50/70 border border-border-subtle rounded-inner p-4">
                    {task.note}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    No notes provided for this task.
                  </p>
                )}
              </div>

              {/* Key Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle/60">
                {/* Team */}
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-nav bg-slate-100 text-text-muted">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      Team
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {task.team || 'Unassigned Team'}
                    </span>
                  </div>
                </div>

                {/* Branch */}
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-nav bg-slate-100 text-text-muted">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      Branch
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {task.branch || 'Headquarters / All'}
                    </span>
                  </div>
                </div>

                {/* Assignment / Ownership */}
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-nav bg-tint-blue-bg text-brand-blue border border-tint-blue-border">
                    {isParent ? <Layers className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      {isParent ? 'Individual Assignments' : 'Assigned To'}
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {isParent
                        ? `${task.subtasks?.length || 0} Team Members`
                        : task.owner || 'Unassigned'}
                    </span>
                    <span className="text-[11px] text-text-muted block">
                      {isParent
                        ? 'Independently managed subtasks'
                        : 'Responsible for completing work'}
                    </span>
                  </div>
                </div>

                {/* Reporting Manager */}
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-nav bg-tint-amber-bg text-tint-amber-text border border-tint-amber-border">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      Reporting Manager
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {task.reportingManager || 'Standard Team Lead'}
                    </span>
                    <span className="text-[11px] text-text-muted block">
                      Responsible for monitoring progress
                    </span>
                  </div>
                </div>

                {/* Deadline or Due Date */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-2 rounded-nav border ${
                      overdue
                        ? 'bg-tint-red-bg text-destructive border-tint-red-border'
                        : dueToday
                        ? 'bg-tint-blue-bg text-brand-blue border-tint-blue-border'
                        : 'bg-slate-100 text-text-muted border-border-subtle'
                    }`}
                  >
                    {task.deadlineAt ? (
                      <Clock className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Calendar className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      {task.deadlineAt
                        ? isParent
                          ? 'Overall Deadline'
                          : 'Deadline'
                        : isParent
                        ? 'Overall Due Date'
                        : 'Due Date'}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-medium ${
                          overdue
                            ? 'text-destructive font-semibold'
                            : dueToday
                            ? 'text-brand-blue font-semibold'
                            : 'text-text-primary'
                        }`}
                      >
                        {task.deadlineAt
                          ? formatDeadline(task.deadlineAt, task.deadlineTimezone || 'Asia/Kolkata', task.due)
                          : formatDateOnly(task.due)}
                        {overdue && ' (Overdue)'}
                        {dueToday && ' (Today)'}
                      </span>
                      {task.reminderMinutesBefore && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          <Bell className="w-3 h-3 text-slate-500" />
                          <span>{task.reminderMinutesBefore}m before</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section: Individual Assignments (Parent Tasks Only) ── */}
          {isParent && (
            <Card className="shadow-card border border-border-subtle">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle/60 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <span>Individual Assignments</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                        {task.subtasks?.length || 0}
                      </span>
                    </h3>
                    <p className="text-xs text-text-muted">
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

                {/* Subtasks List */}
                {task.subtasks && task.subtasks.length > 0 ? (
                  <div className="space-y-3">
                    {task.subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="p-4 rounded-inner border border-border-subtle bg-surface hover:bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-text-primary">
                              {st.title}
                            </span>
                            {st.responsibilityLabel && (
                              <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 rounded-badge px-2 py-0.5 border border-slate-200">
                                {st.responsibilityLabel}
                              </span>
                            )}
                            {!st.isRequired && (
                              <span className="text-[10px] text-text-muted bg-slate-100 rounded-badge px-1.5 py-0.5">
                                Optional
                              </span>
                            )}
                          </div>

                          {st.note && (
                            <p className="text-xs text-text-muted line-clamp-1">
                              {st.note}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap pt-0.5">
                            <div className="flex items-center gap-1 font-medium text-text-primary">
                              <User className="w-3.5 h-3.5 text-text-muted" />
                              <span>{st.owner}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {st.deadlineAt ? (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                                  <span>Deadline {formatDeadline(st.deadlineAt, st.deadlineTimezone || 'Asia/Kolkata', st.due)}</span>
                                </>
                              ) : (
                                <>
                                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                                  <span>Due {formatDateOnly(st.due)}</span>
                                </>
                              )}
                            </div>
                            {st.reminderMinutesBefore && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200">
                                🔔 {st.reminderMinutesBefore}m
                              </span>
                            )}
                            {st.doneAt && (
                              <div className="flex items-center gap-1 text-tint-green-text font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
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
                              team: task.team,
                              branch: task.branch,
                              owner: st.owner,
                              ownerId: st.ownerId,
                              createdBy: task.createdBy,
                              reportingManager: task.reportingManager,
                              taskLevel: 'subtask',
                            } as any}
                            size="sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/tasks/${encodeURIComponent(st.id)}`)}
                            leftIcon={<ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-inner text-xs text-text-muted">
                    <p>No subtasks have been added to this parent task yet.</p>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddSubtaskOpen(true)}
                        className="mt-3"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Add First Member Assignment
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right Column: Overall Progress & Task Information ── */}
        <div className="space-y-6">
          {/* Progress Card (For Parent Tasks) */}
          {isParent && task.progress && (
            <Card className="shadow-card border border-border-subtle bg-gradient-to-br from-white to-slate-50/50">
              <CardContent className="p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-badge bg-tint-blue-bg text-brand-blue border border-tint-blue-border">
                      <Layers className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Overall Progress
                      </h4>
                      <p className="text-xs text-text-muted">
                        Derived from subtask statuses
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-text-primary">
                    {task.progress.progressPercentage}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      task.progress.progressPercentage === 100
                        ? 'bg-[#15803D]'
                        : 'bg-brand-blue',
                    )}
                    style={{ width: `${task.progress.progressPercentage}%` }}
                  />
                </div>

                <div className="space-y-1.5 pt-1 text-xs text-text-muted">
                  <div className="flex items-center justify-between">
                    <span>Required Subtasks:</span>
                    <span className="font-semibold text-text-primary">
                      {task.progress.completedRequiredSubtasks} / {task.progress.requiredSubtasks} Completed
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Assignments:</span>
                    <span className="text-text-primary font-medium">
                      {task.progress.totalSubtasks}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pending:</span>
                    <span className="text-text-primary font-medium">
                      {task.progress.pendingSubtasks}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata Card */}
          <Card className="shadow-card border border-border-subtle">
            <CardContent className="p-5 space-y-3 text-xs">
              <h4 className="font-semibold text-text-primary pb-2 border-b border-border-subtle/60">
                Task Information
              </h4>

              <div className="flex items-center justify-between text-text-muted">
                <span>Task ID:</span>
                <span className="font-mono text-text-primary font-medium truncate max-w-[140px]">
                  {task.id}
                </span>
              </div>

              <div className="flex items-center justify-between text-text-muted">
                <span>Task Level:</span>
                <span className="font-medium text-text-primary capitalize">
                  {task.taskLevel || 'Standalone'}
                </span>
              </div>

              <div className="flex items-center justify-between text-text-muted">
                <span>Created By:</span>
                <span className="font-medium text-text-primary">
                  {task.createdBy || 'System'}
                </span>
              </div>

              {task.createdAt && (
                <div className="flex items-center justify-between text-text-muted">
                  <span>Created:</span>
                  <span className="text-text-primary">{formatDateOnly(task.createdAt)}</span>
                </div>
              )}

              {task.doneAt && (
                <div className="flex items-center justify-between text-tint-green-text font-medium">
                  <span>Completed:</span>
                  <span>{formatDateOnly(task.doneAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Discussion & Activity Tabs (full-width below the grid) ── */}
      <Card className="shadow-card border border-border-subtle">
        {/* Tab bar */}
        <div
          className="flex items-center border-b border-border-subtle px-1 pt-1"
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
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id)
                  if (tab.id === 'discussion' && unreadCount > 0) {
                    markRead()
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer',
                  isActive
                    ? 'border-brand-blue text-brand-blue'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-subtle',
                )}
              >
                <Icon className="w-4 h-4" />
                <span>
                  {tab.id === 'discussion' && isParent
                    ? 'Project Discussion'
                    : tab.label}
                </span>
                {showBadge && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold bg-brand-blue text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab panels */}
        <CardContent className="p-5">
          {/* Discussion panel */}
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

          {/* Activity panel */}
          <div
            role="tabpanel"
            id="tabpanel-activity"
            aria-labelledby="tab-activity"
            hidden={activeTab !== 'activity'}
          >
            {activeTab === 'activity' && (
              <>
                <div className="flex items-center gap-2 pb-4">
                  <History className="w-4 h-4 text-text-muted" />
                  <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider">
                    Activity History
                  </h4>
                </div>
                <ActivityTimeline activities={task.activity} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

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
          navigate('/dashboard', { replace: true })
        }}
      />
    </div>
  )
}
