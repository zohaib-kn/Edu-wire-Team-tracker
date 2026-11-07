import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useUpdateTaskStatus } from '../hooks/useUpdateTaskStatus'
import { canPerformTaskAction } from '../utils/taskPermissions'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'
import type { Task, TaskStatus } from '../types/task.types'

export interface TaskStatusSelectProps {
  task: Task
  size?: 'sm' | 'md'
  disabled?: boolean
}

const statusConfig: Record<
  TaskStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  todo: {
    label: 'To Do',
    badgeClasses: 'bg-tint-blue-bg text-tint-blue-text border-tint-blue-border hover:bg-tint-blue-bg/80',
    dotClasses: 'bg-brand-blue',
  },
  doing: {
    label: 'In Progress',
    badgeClasses: 'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border hover:bg-tint-amber-bg/80',
    dotClasses: 'bg-amber-600',
  },
  done: {
    label: 'Completed',
    badgeClasses: 'bg-tint-green-bg text-tint-green-text border-tint-green-border hover:bg-tint-green-bg/80',
    dotClasses: 'bg-[#15803D]',
  },
}

export function TaskStatusSelect({
  task,
  size = 'sm',
  disabled = false,
}: TaskStatusSelectProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const updateStatusMutation = useUpdateTaskStatus()

  const isPermitted = canPerformTaskAction(user, 'status', task)
  const isUpdating = updateStatusMutation.isPending && updateStatusMutation.variables?.id === task.id
  const canChange = isPermitted && !disabled && !isUpdating

  const current = statusConfig[task.status] || statusConfig.todo

  const handleSelect = (newStatus: TaskStatus) => {
    if (newStatus === task.status || !canChange) {
      setIsOpen(false)
      return
    }
    setIsOpen(false)
    updateStatusMutation.mutate({ id: task.id, status: newStatus })
  }

  // If user cannot change status, show static badge
  if (!canChange && !isUpdating) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-badge font-semibold border select-none',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          current.badgeClasses,
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', current.dotClasses)} />
        {current.label}
      </span>
    )
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={!canChange}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Change task status, current: ${current.label}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-badge font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue/20',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          current.badgeClasses,
          isUpdating && 'opacity-70 cursor-wait',
        )}
      >
        {isUpdating ? (
          <Spinner size="sm" className="w-3 h-3 text-current" />
        ) : (
          <span className={cn('w-1.5 h-1.5 rounded-full', current.dotClasses)} />
        )}
        <span>{current.label}</span>
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          />
          <div
            role="listbox"
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 mt-1 w-36 rounded-card bg-surface border border-border-subtle shadow-dropdown py-1 z-50 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          >
            {(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => {
              const cfg = statusConfig[st]
              const isSelected = task.status === st
              return (
                <button
                  key={st}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(st)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 transition-colors cursor-pointer',
                    isSelected && 'font-semibold text-text-primary bg-slate-50/70',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', cfg.dotClasses)} />
                    <span>{cfg.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-blue" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
