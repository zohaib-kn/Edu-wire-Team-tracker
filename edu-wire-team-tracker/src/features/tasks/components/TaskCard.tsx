import { useNavigate } from 'react-router-dom'
import { Calendar, User, MoreVertical, Edit2, Trash2, ArrowUpRight } from 'lucide-react'
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
        'group relative flex flex-col justify-between rounded-xl bg-white border p-4 transition-all duration-150 cursor-pointer shadow-xs',
        'hover:shadow-sm hover:border-slate-300',
        overdue
          ? 'border-red-200 bg-red-50/10'
          : 'border-[#E2E8F0]',
      )}
    >
      <div>
        {/* Top meta strip: Team, Priority, and More Menu */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.team && (
              <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                {task.team}
              </span>
            )}
            <TaskPriorityBadge priority={task.priority} />
            {task.reportingManager && (
              <span
                className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200/60"
                title={`Reporting Manager: ${task.reportingManager}`}
              >
                RM: {task.reportingManager}
              </span>
            )}
          </div>

          {/* Action Menu (Edit/Delete) */}
          {(canEdit || canDelete) && (
            <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Task options"
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-36 rounded-lg bg-white border border-[#E2E8F0] shadow-lg py-1 z-30 text-xs focus:outline-none"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate(`/tasks/${encodeURIComponent(task.id)}`)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                    <span>View Details</span>
                  </button>

                  {canEdit && onEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onEdit(task)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
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
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#DC2626] hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Task Title */}
        <h4 className="text-sm font-semibold text-[#0F172A] leading-snug line-clamp-2 group-hover:text-[#1D4ED8] transition-colors mb-2">
          {task.title}
        </h4>

        {/* Task Note Preview */}
        {task.note && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">
            {task.note}
          </p>
        )}
      </div>

      {/* Card Footer: Owner, Due Date & Status */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-3 text-xs text-slate-500 min-w-0">
          {/* Owner */}
          <div className="flex items-center gap-1 truncate" title={`Assigned to ${task.owner}`}>
            <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{task.owner || 'Unassigned'}</span>
          </div>

          {/* Due date */}
          {task.due && (
            <div
              className={cn(
                'flex items-center gap-1 shrink-0',
                overdue && 'text-[#DC2626] font-semibold',
                dueToday && 'text-[#1D4ED8] font-semibold',
              )}
              title={overdue ? 'Overdue' : dueToday ? 'Due Today' : `Due on ${formatDateOnly(task.due)}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{dueToday ? 'Today' : formatDateOnly(task.due)}</span>
            </div>
          )}
        </div>

        {/* Quick status selector */}
        <div onClick={(e) => e.stopPropagation()}>
          <TaskStatusSelect task={task} size="sm" />
        </div>
      </div>
    </div>
  )
}

