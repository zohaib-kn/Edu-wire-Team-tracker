import { useLocation, useNavigate } from 'react-router-dom'
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
import { TaskFolderExplorer } from './TaskFolderExplorer'
import { Folder, type FolderEntry } from '@/components/ui/Folder'
import {
  formatDateOnly,
  formatDeadline,
  isTaskOverdue,
  isTaskDueToday,
} from '../utils/dateUtils'
import { canPerformTaskAction } from '../utils/taskPermissions'
import { getTaskDetailNavState } from '../utils/taskNavigation'
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
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isExplorerOpen, setIsExplorerOpen] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const projectContainerRef = useRef<HTMLDivElement>(null)
  const folderTriggerRef = useRef<HTMLDivElement>(null)

  const canEdit = canPerformTaskAction(user, 'edit', task)
  const canDelete = canPerformTaskAction(user, 'delete', task)

  const overdue = isTaskOverdue(task.due, task.status, task.deadlineAt)
  const dueToday = isTaskDueToday(task.due, task.status, task.deadlineAt)

  const hasSubtasks =
    task.taskLevel === 'parent' && Boolean(task.subtasks && task.subtasks.length > 0)
  const subtasks = useMemo(() => task.subtasks || [], [task.subtasks])

  const totalSubtasksCount = task.progress?.totalSubtasks ?? subtasks.length
  const completedSubtasksCount = useMemo(
    () =>
      task.progress?.completedSubtasks ??
      subtasks.filter((sub) => sub.status === 'done').length,
    [task.progress?.completedSubtasks, subtasks],
  )
  const progressPercentage =
    task.progress?.progressPercentage ??
    (totalSubtasksCount > 0
      ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100)
      : 0)

  const parentTitle =
    task.parentTask && typeof task.parentTask === 'object' && 'title' in task.parentTask
      ? task.parentTask.title
      : null

  // Measure parent column width so folder preview always fits inside its column
  useEffect(() => {
    if (!hasSubtasks) return undefined
    const node = projectContainerRef.current
    if (!node) return undefined

    const updateWidth = () => {
      setContainerWidth(node.clientWidth)
    }
    updateWidth()

    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasSubtasks])

  const folderScale =
    containerWidth > 0
      ? Math.min(1.02, Math.max(0.72, (containerWidth - 36) / 224))
      : 0.96

  // Limit decorative previews inside the folder pocket to 2–3 minimal sheets
  const folderPreviewItems = useMemo<FolderEntry[]>(() => {
    if (!subtasks || subtasks.length === 0) return []

    return subtasks.slice(0, 3).map((sub) => {
      const isDone = sub.status === 'done'
      const isDoing = sub.status === 'doing'

      return {
        id: sub.id,
        title: sub.title,
        content: (
          <div className="box-border flex h-full flex-col justify-between p-2.5 select-none text-left bg-white rounded-[7px]">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-1">
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
                <span
                  className={cn(
                    'text-[8.5px] font-semibold tracking-tight whitespace-nowrap',
                    isDone
                      ? 'text-emerald-700'
                      : isDoing
                        ? 'text-amber-700'
                        : 'text-slate-600',
                  )}
                >
                  {isDone ? 'Done' : isDoing ? 'In Progress' : 'To Do'}
                </span>
              </div>

              <p
                className={cn(
                  'text-[10px] font-semibold leading-tight line-clamp-2 text-slate-800',
                  isDone && 'line-through text-slate-400',
                )}
              >
                {sub.title}
              </p>
            </div>

            {/* Minimal neutral preview bars (no unreadable micro-controls) */}
            <div className="space-y-1.5 pt-2">
              <div className="h-1 w-4/5 rounded-full bg-slate-200/80" />
              <div className="h-1 w-3/5 rounded-full bg-slate-200/60" />
            </div>
          </div>
        ),
      }
    })
  }, [subtasks])

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

  // Compact 3D Folder Preview + Right-Side Drawer for Grouped Parent Projects
  if (hasSubtasks) {
    const folderColor =
      task.status === 'done'
        ? '#10B981'
        : task.status === 'doing'
          ? '#D97706'
          : '#2563EB'

    return (
      <>
        <div
          ref={projectContainerRef}
          className={cn(
            'group relative flex flex-col min-w-0 rounded-inner bg-surface border p-3.5 sm:p-4 shadow-card transition-all duration-150',
            'hover:shadow-card-hover hover:border-slate-300',
            overdue
              ? 'border-tint-red-border/90 bg-tint-red-bg/10'
              : task.status === 'done'
                ? 'border-tint-green-border/80 bg-tint-green-bg/10'
                : 'border-border-subtle',
          )}
        >
          {/* Compact Folder Preview centered inside column bounds */}
          <div className="flex items-center justify-center pt-3 pb-4 w-full min-w-0 overflow-visible">
            <Folder
              label={task.title}
              mode="flap"
              variant="solid"
              layout="spread"
              color={folderColor}
              paperColor="#FFFFFF"
              tabPosition="right"
              openOn="none"
              previewOnly={true}
              maxPreviewItems={3}
              size={folderScale}
              bounce={0.35}
              peek={true}
              intro={false}
              tilt={0.35}
              zoomOnClick={false}
              draggable={false}
              theme="light"
              triggerRef={folderTriggerRef}
              ariaLabel={`Open ${task.title} project tasks (${totalSubtasksCount} tasks, ${completedSubtasksCount} completed)`}
              onFolderClick={() => setIsExplorerOpen(true)}
              items={folderPreviewItems}
            />
          </div>

          {/* Project Title, Progress & Actions */}
          <div className="pt-2.5 border-t border-border-subtle/70 space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsExplorerOpen(true)}
                className="min-w-0 flex-1 text-left group/title focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded cursor-pointer"
              >
                <h4 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 group-hover/title:text-brand-blue transition-colors">
                  {task.title}
                </h4>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {task.priority === 'high' && <TaskPriorityBadge priority="high" />}

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    aria-label={`Project options for ${task.title}`}
                    aria-expanded={menuOpen}
                    className="p-1 rounded-badge text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-1 w-40 rounded-card bg-surface border border-border-subtle shadow-dropdown py-1 z-30 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false)
                          setIsExplorerOpen(true)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-slate-50 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
                        <span>Open Tasks ({totalSubtasksCount})</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false)
                          navigate(`/tasks/${encodeURIComponent(task.id)}`, {
                            state: getTaskDetailNavState(location),
                          })
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-slate-50 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
                        <span>Project Details</span>
                      </button>

                      {canEdit && onEdit && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false)
                            onEdit(task)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-text-primary hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-text-muted" />
                          <span>Edit Project</span>
                        </button>
                      )}

                      {canDelete && onDelete && (
                        <button
                          type="button"
                          role="menuitem"
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
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
              <span className="truncate">
                <span className="font-semibold text-text-primary">{totalSubtasksCount}</span>{' '}
                {totalSubtasksCount === 1 ? 'Task' : 'Tasks'} ·{' '}
                <span className="font-semibold text-text-primary">{completedSubtasksCount}</span>{' '}
                Completed
              </span>
              <span className="font-semibold text-text-primary shrink-0">
                {progressPercentage}%
              </span>
            </div>

            <div
              className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${task.title} completion ${progressPercentage}%`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  progressPercentage === 100
                    ? 'bg-[#15803D]'
                    : task.status === 'doing'
                      ? 'bg-amber-500'
                      : 'bg-brand-blue',
                )}
                style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
              />
            </div>
          </div>
        </div>

        <TaskFolderExplorer
          isOpen={isExplorerOpen}
          onClose={() => setIsExplorerOpen(false)}
          projectTask={task}
          triggerRef={folderTriggerRef}
        />
      </>
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
        'group relative flex flex-col justify-between min-w-0 rounded-inner bg-surface border p-3.5 sm:p-4 transition-all duration-150 cursor-pointer shadow-card',
        'hover:shadow-card-hover hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
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
                        navigate(`/tasks/${encodeURIComponent(task.id)}`, {
                          state: getTaskDetailNavState(location),
                        })
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
