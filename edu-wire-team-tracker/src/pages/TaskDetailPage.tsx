import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTask } from '@/features/tasks/hooks/useTask'
import { TaskStatusSelect } from '@/features/tasks/components/TaskStatusSelect'
import { TaskPriorityBadge } from '@/features/tasks/components/TaskPriorityBadge'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'
import { TaskDeleteDialog } from '@/features/tasks/components/TaskDeleteDialog'
import { ActivityTimeline } from '@/features/tasks/components/ActivityTimeline'
import { formatDateOnly, isTaskOverdue, isTaskDueToday } from '@/features/tasks/utils/dateUtils'
import { canPerformTaskAction } from '@/features/tasks/utils/taskPermissions'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { usePageHeader } from '@/context/HeaderContext'

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: task, isLoading, isError, refetch } = useTask(id || '')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const canEdit = canPerformTaskAction(user, 'edit', task)
  const canDelete = canPerformTaskAction(user, 'delete', task)
  const overdue = task ? isTaskOverdue(task.due, task.status) : false
  const dueToday = task ? isTaskDueToday(task.due, task.status) : false

  // Connect actions to Header.tsx with collapsing on mobile
  usePageHeader({
    title: task ? task.title : 'Task Details',
    subtitle: task
      ? `Task ID: ${task.id} • ${task.team || 'General'}`
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
      {/* Main Grid: Details (Left) + Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Task Header, Properties & Notes */}
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
                  <span className="text-xs text-text-muted font-medium">Priority:</span>
                  <TaskPriorityBadge priority={task.priority} />
                </div>
              </div>

              {/* Task Title */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary leading-tight">
                  {task.title}
                </h1>
              </div>

              {/* Note / Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Notes & Details
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

                {/* Assigned Owner (Completes Work) */}
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-nav bg-tint-blue-bg text-brand-blue border border-tint-blue-border">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      Assigned To
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {task.owner || 'Unassigned'}
                    </span>
                    <span className="text-[11px] text-text-muted block">
                      Responsible for completing work
                    </span>
                  </div>
                </div>

                {/* Reporting Manager (Monitors Progress) */}
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

                {/* Due Date */}
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
                    <Calendar className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                      Due Date
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        overdue
                          ? 'text-destructive font-semibold'
                          : dueToday
                          ? 'text-brand-blue font-semibold'
                          : 'text-text-primary'
                      }`}
                    >
                      {formatDateOnly(task.due)}
                      {overdue && ' (Overdue)'}
                      {dueToday && ' (Today)'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Metadata & Activity History */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="shadow-card border border-border-subtle">
            <CardContent className="p-5 space-y-3 text-xs">
              <h4 className="font-semibold text-text-primary pb-2 border-b border-border-subtle/60">
                Task Information
              </h4>

              <div className="flex items-center justify-between text-text-muted">
                <span>Task ID:</span>
                <span className="font-mono text-text-primary font-medium">{task.id}</span>
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

          {/* Activity Timeline Card */}
          <Card className="shadow-card border border-border-subtle">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border-subtle/60">
                <History className="w-4 h-4 text-text-muted" />
                <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider">
                  Activity History
                </h4>
              </div>

              <ActivityTimeline activities={task.activity} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Task Sheet */}
      <TaskFormSheet
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        taskToEdit={task}
      />

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
