import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import {
  formatDateKey,
  formatUTCInTimezone,
  formatHourLabel,
  formatDayHeaderLong,
} from '@/features/tasks/utils/dateUtils'
import { ScheduleTaskCard } from './ScheduleTaskCard'
import type { Task } from '@/features/tasks/types/task.types'

export interface DayViewProps {
  currentDate: Date
  tasks: Task[]
  className?: string
}

export function DayView({ currentDate, tasks, className }: DayViewProps) {
  const currentDateKey = formatDateKey(currentDate)
  const isToday = currentDateKey === formatDateKey(new Date())

  // Separate tasks into untimed (date-only) vs timed tasks
  const { untimedTasks, tasksByHour } = useMemo(() => {
    const untimed: Task[] = []
    const byHour: Record<number, Task[]> = {}

    // Initialize working hours 8..20
    for (let h = 8; h <= 20; h++) {
      byHour[h] = []
    }

    for (const t of tasks) {
      const cleanDue = t.due ? (t.due.includes('T') ? t.due.split('T')[0] : t.due) : ''
      if (cleanDue !== currentDateKey) continue

      if (!t.deadlineAt) {
        untimed.push(t)
      } else {
        const local = formatUTCInTimezone(t.deadlineAt, t.deadlineTimezone || 'Asia/Kolkata')
        const hour = parseInt(local.time.split(':')[0], 10)
        const targetHour = isNaN(hour) ? 17 : hour

        if (!byHour[targetHour]) {
          byHour[targetHour] = []
        }
        byHour[targetHour].push(t)
      }
    }

    // Sort tasks in each hour by exact deadlineAt
    Object.keys(byHour).forEach((hStr) => {
      const h = parseInt(hStr, 10)
      byHour[h].sort((a, b) => {
        const timeA = a.deadlineAt ? new Date(a.deadlineAt).getTime() : 0
        const timeB = b.deadlineAt ? new Date(b.deadlineAt).getTime() : 0
        return timeA - timeB
      })
    })

    return { untimedTasks: untimed, tasksByHour: byHour }
  }, [tasks, currentDateKey])

  // Get sorted list of hours to display (ensuring working hours 8..20 plus any with tasks)
  const displayHours = useMemo(() => {
    const hours = Object.keys(tasksByHour).map(Number)
    return hours.sort((a, b) => a - b)
  }, [tasksByHour])

  const totalTasksToday = untimedTasks.length + Object.values(tasksByHour).flat().length

  return (
    <div className={`bg-white rounded-xl border border-border-subtle p-5 shadow-xs ${className || ''}`}>
      {/* Day Header */}
      <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            {formatDayHeaderLong(currentDate)}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {totalTasksToday === 0
              ? 'No task deadlines on this day.'
              : `${totalTasksToday} task${totalTasksToday === 1 ? '' : 's'} scheduled.`}
          </p>
        </div>

        {isToday && (
          <span className="px-2.5 py-1 text-xs font-bold text-brand-blue bg-blue-50 border border-blue-200 rounded-full">
            Today
          </span>
        )}
      </div>

      {/* =========================================================================
          SECTION: Date-Only Tasks ("Due Today — No Set Time")
          Strict requirement: Date-only tasks appear in a separate section, NOT at an invented hour!
         ========================================================================= */}
      {untimedTasks.length > 0 && (
        <div className="my-5 p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Due Today — No Set Time ({untimedTasks.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Untimed calendar assignments
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {untimedTasks.map((task) => (
              <ScheduleTaskCard key={task.id} task={task} showStatusSelect />
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION: Hourly Timeline (Tasks placed at exact deadline times)
         ========================================================================= */}
      <div className="mt-6 space-y-1 relative">
        {displayHours.map((hour) => {
          const hourTasks = tasksByHour[hour] || []
          const hasTasks = hourTasks.length > 0

          return (
            <div
              key={hour}
              className={`flex items-start gap-4 min-h-[58px] py-2 border-t border-slate-100 transition-colors ${
                hasTasks ? 'bg-slate-50/30 rounded-lg px-2' : ''
              }`}
            >
              {/* Hour Label */}
              <div className="w-20 shrink-0 text-right pr-2">
                <span className="text-xs font-semibold text-slate-400">
                  {formatHourLabel(hour)}
                </span>
              </div>

              {/* Timeline Slot Content */}
              <div className="flex-1 min-w-0">
                {hasTasks ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {hourTasks.map((task) => (
                      <ScheduleTaskCard key={task.id} task={task} showStatusSelect />
                    ))}
                  </div>
                ) : (
                  <div className="h-6 border-b border-dashed border-slate-100/70" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
