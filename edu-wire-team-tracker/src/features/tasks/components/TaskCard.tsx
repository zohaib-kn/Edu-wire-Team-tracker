import { useNavigate } from 'react-router-dom'
import { Calendar, User, MoreVertical, Edit2, Trash2, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { TaskStatusSelect } from './TaskStatusSelect'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { formatDateOnly, isTaskOverdue, isTaskDueToday } from '../utils/dateUtils'
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

  const overdue = isTaskOverdue(task.due, task.status)
  const dueToday = isTaskDueToday(task.due, task.status)

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
          <h4 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-brand-blue transition-colors">
            {task.title}
          </h4>

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

        {/* Tags row: Team & Reporting Manager */}
        {(task.team || task.reportingManager) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[10px]">
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
        )}
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
