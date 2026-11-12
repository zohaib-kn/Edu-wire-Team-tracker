import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  align?: 'left' | 'right'
}

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'doing', 'done']

const statusConfig: Record<
  TaskStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  todo: {
    label: 'To Do',
    badgeClasses:
      'bg-tint-blue-bg text-tint-blue-text border-tint-blue-border hover:bg-tint-blue-bg/80',
    dotClasses: 'bg-brand-blue',
  },
  doing: {
    label: 'In Progress',
    badgeClasses:
      'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border hover:bg-tint-amber-bg/80',
    dotClasses: 'bg-amber-600',
  },
  done: {
    label: 'Completed',
    badgeClasses:
      'bg-tint-green-bg text-tint-green-text border-tint-green-border hover:bg-tint-green-bg/80',
    dotClasses: 'bg-[#15803D]',
  },
}

interface MenuCoords {
  left: number
  top?: number
  bottom?: number
}

export function TaskStatusSelect({
  task,
  size = 'sm',
  disabled = false,
  align = 'left',
}: TaskStatusSelectProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<MenuCoords>({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const updateStatusMutation = useUpdateTaskStatus()

  const isParent = task.taskLevel === 'parent'
  const isPermitted = canPerformTaskAction(user, 'status', task) && !isParent
  const isUpdating =
    updateStatusMutation.isPending && updateStatusMutation.variables?.id === task.id
  const canChange = isPermitted && !disabled && !isUpdating

  const current = statusConfig[task.status] || statusConfig.todo

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuWidth = 144
    const margin = 8
    const estimatedHeight = 128

    const rawLeft = align === 'right' ? rect.right - menuWidth : rect.left
    const left = Math.max(margin, Math.min(rawLeft, window.innerWidth - menuWidth - margin))

    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight

    if (openUpward) {
      setCoords({ left, bottom: window.innerHeight - rect.top + 4 })
    } else {
      setCoords({ left, top: rect.bottom + 4 })
    }
  }, [align])

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined

    const selectedIdx = Math.max(0, STATUS_OPTIONS.indexOf(task.status))
    const focusTimer = window.requestAnimationFrame(() => {
      optionRefs.current[selectedIdx]?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        closeMenu(true)
        return
      }
      if (event.key === 'Tab') {
        closeMenu(false)
      }
    }

    const handleScrollOrResize = (event: Event) => {
      if (event.type === 'scroll' && menuRef.current?.contains(event.target as Node)) {
        return
      }
      closeMenu(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      window.cancelAnimationFrame(focusTimer)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen, task.status, closeMenu])

  const handleSelect = (newStatus: TaskStatus) => {
    if (newStatus === task.status || !canChange) {
      closeMenu(true)
      return
    }
    closeMenu(true)
    updateStatusMutation.mutate({ id: task.id, status: newStatus })
  }

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      optionRefs.current[(index + 1) % STATUS_OPTIONS.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      optionRefs.current[(index - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      optionRefs.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      optionRefs.current[STATUS_OPTIONS.length - 1]?.focus()
    }
  }

  // If user cannot change status, show static badge
  if (!canChange && !isUpdating) {
    return (
      <span
        title={isParent ? 'Status derived automatically from subtasks' : undefined}
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
        ref={triggerRef}
        type="button"
        disabled={!canChange}
        onClick={(e) => {
          e.stopPropagation()
          if (isOpen) {
            closeMenu(false)
          } else {
            updateMenuPosition()
            setIsOpen(true)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Change task status, current: ${current.label}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-badge font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
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

      {isOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={(e) => {
                e.stopPropagation()
                closeMenu(true)
              }}
              aria-hidden="true"
            />
            <div
              ref={menuRef}
              role="listbox"
              aria-label="Select task status"
              style={{
                left: `${coords.left}px`,
                top: coords.top !== undefined ? `${coords.top}px` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
              className="fixed w-36 rounded-card bg-surface border border-border-subtle shadow-dropdown py-1 z-[60] text-xs focus:outline-none"
            >
              {STATUS_OPTIONS.map((st, idx) => {
                const cfg = statusConfig[st]
                const isSelected = task.status === st
                return (
                  <button
                    key={st}
                    ref={(el) => {
                      optionRefs.current[idx] = el
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(st)}
                    onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue transition-colors cursor-pointer',
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
          </>,
          document.body,
        )}
    </div>
  )
}
