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

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: task, isLoading, isError, refetch } = useTask(id || '')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Spinner size="lg" className="text-[#1D4ED8] mb-3" />
        <p className="text-sm">Loading task details...</p>
      </div>
    )
  }

  if (isError || !task) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-12 text-center max-w-lg mx-auto">
        <h3 className="text-base font-semibold text-red-900 mb-1">
          Task Not Found
        </h3>
        <p className="text-xs text-red-600 mb-4">
          The requested task could not be loaded or has been deleted.
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

  const canEdit = canPerformTaskAction(user, 'edit', task)
  const canDelete = canPerformTaskAction(user, 'delete', task)
  const overdue = isTaskOverdue(task.due, task.status)
  const dueToday = isTaskDueToday(task.due, task.status)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation & Action Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              leftIcon={<Edit2 className="w-3.5 h-3.5 text-slate-500" />}
            >
              Edit Task
            </Button>
          )}

          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Details (Left) + Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Task Header, Properties & Notes */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xs border border-[#E2E8F0]">
            <CardContent className="p-6 space-y-6">
              {/* Status and Priority Meta */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Status:</span>
                  <TaskStatusSelect task={task} size="md" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Priority:</span>
                  <TaskPriorityBadge priority={task.priority} />
                </div>
              </div>

              {/* Task Title */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-tight">
                  {task.title}
                </h1>
              </div>

              {/* Note / Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Notes & Details
                </h4>
                {task.note ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200/80 rounded-lg p-4">
                    {task.note}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No notes provided for this task.
                  </p>
                )}
              </div>

              {/* Key Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                {/* Team */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-slate-100 text-slate-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Team
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {task.team || 'Unassigned Team'}
                    </span>
                  </div>
                </div>

                {/* Branch */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-slate-100 text-slate-500">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Branch
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {task.branch || 'Headquarters / All'}
                    </span>
                  </div>
                </div>

                {/* Assigned Owner */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-blue-50 text-[#1D4ED8]">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Assigned Owner
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {task.owner || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-1.5 rounded-md ${
                      overdue
                        ? 'bg-red-50 text-[#DC2626]'
                        : dueToday
                        ? 'bg-blue-50 text-[#1D4ED8]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Due Date
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        overdue
                          ? 'text-[#DC2626] font-semibold'
                          : dueToday
                          ? 'text-[#1D4ED8] font-semibold'
                          : 'text-slate-800'
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
          <Card className="shadow-xs border border-[#E2E8F0]">
            <CardContent className="p-5 space-y-3 text-xs">
              <h4 className="font-semibold text-slate-900 pb-2 border-b border-slate-100">
                Task Information
              </h4>

              <div className="flex items-center justify-between text-slate-500">
                <span>Task ID:</span>
                <span className="font-mono text-slate-800">{task.id}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Created By:</span>
                <span className="font-medium text-slate-800">
                  {task.createdBy || 'System'}
                </span>
              </div>

              {task.createdAt && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Created:</span>
                  <span>{formatDateOnly(task.createdAt)}</span>
                </div>
              )}

              {task.doneAt && (
                <div className="flex items-center justify-between text-green-700">
                  <span>Completed:</span>
                  <span>{formatDateOnly(task.doneAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline Card */}
          <Card className="shadow-xs border border-[#E2E8F0]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
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
