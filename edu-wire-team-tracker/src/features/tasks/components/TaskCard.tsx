import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  User,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { TaskStatusSelect } from './TaskStatusSelect'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { Folder, type FolderEntry } from '@/components/ui/Folder'
import {
  formatDateOnly,
  formatDeadline,
  isTaskOverdue,
  isTaskDueToday,
} from '../utils/dateUtils'
import { canPerformTaskAction } from '../utils/taskPermissions'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import type { Task } from '../types/task.types'

export interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
}

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const canEdit = canPerformTaskAction(user, 'edit', task)
  const canDelete = canPerformTaskAction(user, 'delete', task)

  const overdue = isTaskOverdue(task.due, task.status, task.deadlineAt)
  const dueToday = isTaskDueToday(task.due, task.status, task.deadlineAt)

  const hasSubtasks =
    task.taskLevel === 'parent' && Boolean(task.subtasks && task.subtasks.length > 0)
  const subtasks = task.subtasks || []

  const parentTitle =
    task.parentTask && typeof task.parentTask === 'object' && 'title' in task.parentTask
      ? (task.parentTask as any).title
      : null

  // Memoize Folder entries for multi-assignee Parent Task
  const folderItems = useMemo<FolderEntry[]>(() => {
    if (!subtasks || subtasks.length === 0) return []

    return subtasks.map((sub) => {
      const isDone = sub.status === 'done'
      const isDoing = sub.status === 'doing'

      return {
        id: sub.id,
        title: sub.title,
        description: `${sub.owner}${sub.responsibilityLabel ? ` • ${sub.responsibilityLabel}` : ''}`,
        content: (
          <div className="box-border flex h-full flex-col justify-between p-2.5 select-none text-left bg-white rounded-[7px]">
            <div className="min-w-0 space-y-1.5">
              {/* Row 1: Minimalist Status (no background box, single line) */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[9px] font-semibold tracking-tight whitespace-nowrap',
                    isDone
                      ? 'text-emerald-600'
                      : isDoing
                        ? 'text-amber-600'
                        : 'text-slate-600',
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      isDone
                        ? 'bg-emerald-500'
                        : isDoing
                          ? 'bg-amber-500'
                          : 'bg-brand-blue',
                    )}
                  />
                  <span>{isDone ? 'Done' : isDoing ? 'Doing' : 'To Do'}</span>
                </span>
              </div>

              {/* Row 2: Subtask Title */}
              <h5
                className={cn(
                  'text-[11px] font-bold leading-[1.25] line-clamp-2 text-slate-900',
                  isDone && 'line-through text-slate-400',
                )}
                title={sub.title}
              >
                {sub.title}
              </h5>

              {/* Row 3: Assignee & Role/Label */}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1 text-[9.5px] text-slate-500 font-medium min-w-0">
                  <User className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                  <span className="truncate">{sub.owner}</span>
                </div>

                {sub.responsibilityLabel && (
                  <div className="min-w-0">
                    <span className="inline-block max-w-full truncate text-[8.5px] font-medium px-1.5 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-200/80">
                      {sub.responsibilityLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Row 4: Clean Deadline / Due Date */}
              {(sub.deadlineAt || sub.due) && (
                <div className="flex items-center gap-1 text-[8px] leading-tight min-w-0">
                  {sub.deadlineAt ? (
                    <Clock className="w-2.5 h-2.5 shrink-0 text-brand-blue" />
                  ) : (
                    <Calendar className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                  )}
                  <span
                    className={cn(
                      'truncate font-medium',
                      sub.deadlineAt ? 'text-brand-blue' : 'text-slate-500',
                    )}
                    title={
                      sub.deadlineAt
                        ? formatDeadline(sub.deadlineAt, sub.deadlineTimezone || 'Asia/Kolkata', sub.due)
                        : formatDateOnly(sub.due)
                    }
                  >
                    {sub.deadlineAt
                      ? formatDeadline(sub.deadlineAt, sub.deadlineTimezone || 'Asia/Kolkata', sub.due)
                      : formatDateOnly(sub.due)}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Row: Minimalistic Action Button (no blue bg, clearly visible) */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/tasks/${encodeURIComponent(sub.id)}`)
              }}
              className="w-full py-1 px-2 mt-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-200 hover:border-slate-300 text-[9px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer active:scale-[0.98] shrink-0"
              title="Open Task Details"
            >
              <span>View Task</span>
              <ArrowUpRight className="w-2.5 h-2.5 text-slate-500 shrink-0" />
            </button>
          </div>
        ),
      }
    })
  }, [subtasks, navigate])

  // Close card actions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCardClick = () => {
    navigate(`/tasks/${encodeURIComponent(task.id)}`)
  }

  // Pure 3D Animated Folder for Multi-Assignee Parent Tasks (No outer card container)
  if (hasSubtasks) {
    return (
      <div
        className="relative flex items-center justify-center py-6 px-1 my-2 overflow-visible select-none cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => navigate(`/tasks/${encodeURIComponent(task.id)}`)}
        title="Click folder to open subtasks (Double-click to open parent details)"
      >
        <Folder
          label={task.title}
          mode="flap"
          variant="solid"
          layout="spread"
          color={
            task.status === 'done'
              ? '#10B981'
              : task.status === 'doing'
                ? '#3B82F6'
                : '#2563EB'
          }
          paperColor="#FFFFFF"
          tabPosition="right"
          openOn="click"
          size={1.15}
          bounce={0.4}
          peek={true}
          zoomOnClick={true}
          draggable={false}
          theme="light"
          items={folderItems}
        />
      </div>
    )
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group relative flex flex-col justify-between rounded-inner bg-surface border p-3.5 sm:p-4 transition-all duration-150 cursor-pointer shadow-card',
        'hover:shadow-card-hover hover:border-slate-300',
        overdue
          ? 'border-tint-red-border/90 bg-tint-red-bg/15'
          : task.status === 'done'
            ? 'border-tint-green-border/80 bg-tint-green-bg/10'
            : 'border-border-subtle',
      )}
    >
      <div>
        {/* Top header row: Title on left, Priority badge + optional more menu on right */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            {parentTitle && (
              <span className="text-[11px] font-medium text-brand-blue block truncate mb-0.5">
                {parentTitle} /
              </span>
            )}
            <h4 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-brand-blue transition-colors">
              {task.title}
            </h4>
          </div>

          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <TaskPriorityBadge priority={task.priority} />

            {/* Action Menu (Edit/Delete) */}
            {(canEdit || canDelete) && (
              <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="Task options"
                  className="p-1 rounded-badge text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-36 rounded-card bg-surface border border-border-subtle shadow-dropdown py-1 z-30 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        navigate(`/tasks/${encodeURIComponent(task.id)}`)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-slate-50 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
                      <span>View Details</span>
                    </button>

                    {canEdit && onEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onEdit(task)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-text-muted" />
                        <span>Edit Task</span>
                      </button>
                    )}

                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onDelete(task)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-destructive hover:bg-tint-red-bg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Note snippet if present */}
        {task.note && (
          <p className="text-xs text-text-muted line-clamp-1 mb-2.5">
            {task.note}
          </p>
        )}

        {/* Tags row: Team, Reporting Manager, Parent/Subtask tags, Responsibility */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[10px]">
          {task.taskLevel === 'parent' && (
            <span className="inline-flex items-center font-semibold text-brand-blue bg-tint-blue-bg rounded-badge px-1.5 py-0.5 border border-tint-blue-border">
              Parent Task
            </span>
          )}
          {task.progress && (
            <span className="inline-flex items-center font-medium text-text-muted bg-slate-100 rounded-badge px-1.5 py-0.5">
              {task.progress.completedRequiredSubtasks}/{task.progress.requiredSubtasks} Done ({task.progress.progressPercentage}%)
            </span>
          )}
          {task.responsibilityLabel && (
            <span className="inline-flex items-center font-medium text-slate-700 bg-slate-100 rounded-badge px-1.5 py-0.5 border border-slate-200">
              {task.responsibilityLabel}
            </span>
          )}
          {task.team && (
            <span className="inline-flex items-center text-text-muted bg-slate-100 rounded-badge px-1.5 py-0.5 font-medium">
              {task.team}
            </span>
          )}
          {task.reportingManager && (
            <span
              className="inline-flex items-center font-medium text-tint-amber-text bg-tint-amber-bg rounded-badge px-1.5 py-0.5 border border-tint-amber-border"
              title={`Reporting Manager: ${task.reportingManager}`}
            >
              RM: {task.reportingManager}
            </span>
          )}
        </div>
      </div>

      {/* Card Footer: Due Date & Assignee / Status Selector */}
      <div className="pt-2.5 border-t border-border-subtle/60 flex items-center justify-between gap-2 mt-auto">
        {/* Due Date or Completion indicator */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
          {task.status === 'done' && task.doneAt ? (
            <div
              className="flex items-center gap-1 shrink-0 text-tint-green-text font-medium"
              title={`Completed on ${formatDateOnly(task.doneAt)}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
              <span>{formatDateOnly(task.doneAt)}</span>
            </div>
          ) : task.deadlineAt ? (
            <div
              className={cn(
                'flex items-center gap-1 shrink-0',
                overdue && 'text-destructive font-semibold',
                dueToday && 'text-brand-blue font-semibold',
                !overdue && !dueToday && 'text-text-muted',
              )}
              title={
                overdue
                  ? 'Overdue'
                  : dueToday
                    ? 'Due Today'
                    : `Deadline ${formatDeadline(task.deadlineAt, task.deadlineTimezone || 'Asia/Kolkata', task.due)}`
              }
            >
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{formatDeadline(task.deadlineAt, task.deadlineTimezone || 'Asia/Kolkata', task.due)}</span>
            </div>
          ) : task.due ? (
            <div
              className={cn(
                'flex items-center gap-1 shrink-0',
                overdue && 'text-destructive font-semibold',
                dueToday && 'text-brand-blue font-semibold',
                !overdue && !dueToday && 'text-text-muted',
              )}
              title={
                overdue
                  ? 'Overdue'
                  : dueToday
                    ? 'Due Today'
                    : `Due on ${formatDateOnly(task.due)}`
              }
            >
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{dueToday ? 'Today' : formatDateOnly(task.due)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0 text-text-muted/60">
              <Calendar className="w-3.5 h-3.5" />
              <span>No due date</span>
            </div>
          )}

          {/* Owner chip if assigned */}
          {task.owner && (
            <div
              className="hidden sm:flex items-center gap-1 truncate text-text-muted"
              title={`Assigned to ${task.owner}`}
            >
              <span className="text-text-muted/40">•</span>
              <User className="w-3 h-3 shrink-0 text-text-muted/70" />
              <span className="truncate max-w-[90px]">{task.owner}</span>
            </div>
          )}
        </div>

        {/* Quick status selector */}
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <TaskStatusSelect task={task} size="sm" />
        </div>
      </div>
    </div>
  )
}
