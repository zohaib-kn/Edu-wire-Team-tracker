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
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70',
    dotClasses: 'bg-slate-400',
  },
  doing: {
    label: 'In Progress',
    badgeClasses: 'bg-blue-50 text-[#1D4ED8] border-blue-200 hover:bg-blue-100/70',
    dotClasses: 'bg-[#1D4ED8]',
  },
  done: {
    label: 'Done',
    badgeClasses: 'bg-green-50 text-[#16A34A] border-green-200 hover:bg-green-100/70',
    dotClasses: 'bg-[#16A34A]',
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
          'inline-flex items-center gap-1.5 rounded-md font-medium border select-none',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
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
          'inline-flex items-center gap-1.5 rounded-md font-medium border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
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
            className="absolute left-0 mt-1 w-36 rounded-lg bg-white border border-[#E2E8F0] shadow-lg py-1 z-50 text-xs focus:outline-none"
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
                    'w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 transition-colors',
                    isSelected && 'font-semibold text-[#0F172A]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', cfg.dotClasses)} />
                    <span>{cfg.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#1D4ED8]" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

