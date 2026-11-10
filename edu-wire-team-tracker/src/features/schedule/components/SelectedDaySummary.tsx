import { useMemo } from 'react'
import { Plus, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  formatDayHeaderLong,
  formatDateKey,
  isTaskOverdue,
} from '@/features/tasks/utils/dateUtils'
import { ScheduleTaskCard } from './ScheduleTaskCard'
import type { Task } from '@/features/tasks/types/task.types'

export interface SelectedDaySummaryProps {
  selectedDate: Date
  tasks: Task[]
  onOpenCreateTask?: () => void
  className?: string
}

export function SelectedDaySummary({
  selectedDate,
  tasks,
  onOpenCreateTask,
  className,
}: SelectedDaySummaryProps) {
  const selectedDateKey = formatDateKey(selectedDate)

  // Filter tasks belonging to the selected day
  const dayTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Check if task due date matches selected date
      const cleanDue = t.due ? (t.due.includes('T') ? t.due.split('T')[0] : t.due) : ''
      return cleanDue === selectedDateKey
    })
  }, [tasks, selectedDateKey])

  // Split into timed tasks (sorted by time) and date-only untimed tasks
  const { timedTasks, untimedTasks, doneCount, overdueCount, pendingCount } =
    useMemo(() => {
      const timed: Task[] = []
      const untimed: Task[] = []
      let done = 0
      let overdue = 0
      let pending = 0

      for (const t of dayTasks) {
        if (t.status === 'done') {
          done++
        } else {
          pending++
          if (isTaskOverdue(t.due, t.status, t.deadlineAt)) {
            overdue++
          }
        }

        if (t.deadlineAt) {
          timed.push(t)
        } else {
          untimed.push(t)
        }
      }

      // Sort timed tasks ascending by deadlineAt
      timed.sort((a, b) => {
        const timeA = a.deadlineAt ? new Date(a.deadlineAt).getTime() : 0
        const timeB = b.deadlineAt ? new Date(b.deadlineAt).getTime() : 0
        return timeA - timeB
      })

      return {
        timedTasks: timed,
        untimedTasks: untimed,
        doneCount: done,
        overdueCount: overdue,
        pendingCount: pending,
      }
    }, [dayTasks])

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Header */}
      <div className="pb-3 border-b border-border-subtle/80 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Day Summary
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {formatDayHeaderLong(selectedDate)}
          </p>
        </div>

        {onOpenCreateTask && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenCreateTask}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="text-xs py-1 h-8"
          >
            Add
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-1.5 py-3 border-b border-border-subtle/80 text-center">
        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
          <span className="block text-[10px] font-semibold uppercase text-slate-500">
            Total
          </span>
          <span className="text-sm font-bold text-slate-800">{dayTasks.length}</span>
        </div>
        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
          <span className="block text-[10px] font-semibold uppercase text-emerald-700">
            Done
          </span>
          <span className="text-sm font-bold text-emerald-800">{doneCount}</span>
        </div>
        <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100">
          <span className="block text-[10px] font-semibold uppercase text-brand-blue">
            Pending
          </span>
          <span className="text-sm font-bold text-brand-blue">{pendingCount}</span>
        </div>
        <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-100">
          <span className="block text-[10px] font-semibold uppercase text-rose-700">
            Overdue
          </span>
          <span className="text-sm font-bold text-rose-800">{overdueCount}</span>
        </div>
      </div>

      {/* Task Cards List */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-0.5">
        {dayTasks.length === 0 ? (
          <div className="py-8 text-center px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs font-semibold text-slate-700 mb-0.5">
              No tasks scheduled
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              No task deadlines fall on this calendar day.
            </p>
            {onOpenCreateTask && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenCreateTask}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Schedule Task
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Untimed tasks section */}
            {untimedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Due Today — No Set Time ({untimedTasks.length})</span>
                </div>
                <div className="space-y-2">
                  {untimedTasks.map((task) => (
                    <ScheduleTaskCard key={task.id} task={task} showStatusSelect />
                  ))}
                </div>
              </div>
            )}

            {/* Timed tasks section */}
            {timedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Timed Deadlines ({timedTasks.length})</span>
                </div>
                <div className="space-y-2">
                  {timedTasks.map((task) => (
                    <ScheduleTaskCard key={task.id} task={task} showStatusSelect />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
