import { useLocation, useNavigate } from 'react-router-dom'
import {
  Clock,
  Calendar,
  User,
  ArrowUpRight,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  formatTimeAMPM,
  formatUTCInTimezone,
  isTaskOverdue,
} from '@/features/tasks/utils/dateUtils'
import { TaskStatusSelect } from '@/features/tasks/components/TaskStatusSelect'
import { TaskPriorityBadge } from '@/features/tasks/components/TaskPriorityBadge'
import { getTaskDetailNavState } from '@/features/tasks/utils/taskNavigation'
import type { Task } from '@/features/tasks/types/task.types'

export interface ScheduleTaskCardProps {
  task: Task
  compact?: boolean
  showStatusSelect?: boolean
  className?: string
}

export function ScheduleTaskCard({
  task,
  compact = false,
  showStatusSelect = false,
  className,
}: ScheduleTaskCardProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const isOverdue = isTaskOverdue(task.due, task.status, task.deadlineAt)
  const isDone = task.status === 'done'
  const isDoing = task.status === 'doing'
  const isSubtask = task.taskLevel === 'subtask' || Boolean(task.parentTask)

  // Extract deadline time if available
  const deadlineLocal = task.deadlineAt
    ? formatUTCInTimezone(task.deadlineAt, task.deadlineTimezone || 'Asia/Kolkata')
    : null

  const parentTitle =
    task.parentTask && typeof task.parentTask === 'object' && 'title' in task.parentTask
      ? (task.parentTask as any).title
      : null

  const handleCardClick = () => {
    navigate(`/tasks/${encodeURIComponent(task.id)}`, {
      state: getTaskDetailNavState(location),
    })
  }

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open task ${task.title}`}
        onClick={(e) => {
          e.stopPropagation()
          handleCardClick()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          handleCardKeyDown(e)
        }}
        className={cn(
          'group px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none',
          'hover:shadow-sm hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
          isDone
            ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
            : isOverdue
              ? 'bg-rose-50/60 border-rose-200 text-rose-900'
              : isDoing
                ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                : 'bg-white border-slate-200 text-slate-800',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-1.5 mb-0.5">
          <span className="font-semibold truncate max-w-[140px] group-hover:text-brand-blue">
            {task.title}
          </span>
          {deadlineLocal ? (
            <span className="text-[10px] font-medium px-1 rounded bg-slate-100 text-slate-700 shrink-0">
              {formatTimeAMPM(deadlineLocal.time)}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 shrink-0">Date only</span>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="truncate max-w-[90px]">{task.owner || 'Unassigned'}</span>
          {task.priority === 'high' && (
            <span className="text-rose-600 font-bold text-[9px] uppercase">High</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={cn(
        'group p-3 rounded-xl border transition-all cursor-pointer select-none shadow-xs',
        'hover:shadow-md hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
        isDone
          ? 'bg-emerald-50/30 border-emerald-200/90 text-slate-700'
          : isOverdue
            ? 'bg-rose-50/40 border-rose-200 text-rose-950'
            : isDoing
              ? 'bg-amber-50/30 border-amber-200 text-amber-950'
              : 'bg-white border-slate-200 text-slate-900',
        className,
      )}
    >
      {/* Top Meta: Deadline Time & Status/Priority */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {deadlineLocal ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border',
                isOverdue
                  ? 'bg-rose-100 border-rose-300 text-rose-800'
                  : 'bg-blue-50 border-blue-200 text-brand-blue',
              )}
            >
              <Clock className="w-3 h-3" />
              <span>{formatTimeAMPM(deadlineLocal.time)} IST</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              <Calendar className="w-3 h-3" />
              <span>Due {task.due}</span>
            </span>
          )}

          {isOverdue && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
              Overdue
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Done
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {task.priority === 'high' && <TaskPriorityBadge priority="high" />}
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-blue transition-colors shrink-0" />
        </div>
      </div>

      {/* Title */}
      <h4
        className={cn(
          'text-sm font-semibold leading-snug line-clamp-2 mb-1.5 text-slate-900 group-hover:text-brand-blue transition-colors',
          isDone && 'line-through text-slate-500',
        )}
      >
        {task.title}
      </h4>

      {/* Note Snippet */}
      {task.note && (
        <p className="text-xs text-slate-500 line-clamp-1 mb-2.5">{task.note}</p>
      )}

      {/* Parent Task reference badge if Subtask */}
      {isSubtask && parentTitle && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-full">
            <Layers className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">Parent: {parentTitle}</span>
          </span>
        </div>
      )}

      {/* Bottom Row: Owner, Team & Status */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-medium text-slate-700 max-w-[120px]">
            {task.owner || 'Unassigned'}
          </span>
          {task.responsibilityLabel && (
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 truncate max-w-[100px]">
              {task.responsibilityLabel}
            </span>
          )}
        </div>

        {showStatusSelect ? (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <TaskStatusSelect task={task} size="sm" />
          </div>
        ) : (
          <span
            className={cn(
              'text-[11px] font-medium capitalize',
              isDone ? 'text-emerald-700' : isDoing ? 'text-amber-700' : 'text-slate-600',
            )}
          >
            {isDone ? 'Completed' : isDoing ? 'In Progress' : 'To Do'}
          </span>
        )}
      </div>
    </div>
  )
}
