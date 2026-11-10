import { useMemo } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  getWeekRange,
  formatDateKey,
} from '@/features/tasks/utils/dateUtils'
import { ScheduleTaskCard } from './ScheduleTaskCard'
import type { Task } from '@/features/tasks/types/task.types'

export interface WeekViewProps {
  currentDate: Date
  tasks: Task[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  className?: string
}

export function WeekView({
  currentDate,
  tasks,
  selectedDate,
  onSelectDate,
  className,
}: WeekViewProps) {
  const weekRange = useMemo(() => getWeekRange(currentDate), [currentDate])
  const todayKey = formatDateKey(new Date())
  const selectedKey = formatDateKey(selectedDate)

  // Group tasks by day date key (YYYY-MM-DD)
  const tasksByDay = useMemo(() => {
    const map: Record<string, { untimed: Task[]; timed: Task[] }> = {}

    for (const day of weekRange.days) {
      const k = formatDateKey(day)
      map[k] = { untimed: [], timed: [] }
    }

    for (const task of tasks) {
      const cleanDue = task.due
        ? task.due.includes('T')
          ? task.due.split('T')[0]
          : task.due
        : ''

      if (map[cleanDue]) {
        if (task.deadlineAt) {
          map[cleanDue].timed.push(task)
        } else {
          map[cleanDue].untimed.push(task)
        }
      }
    }

    // Sort timed tasks by deadlineAt
    Object.keys(map).forEach((k) => {
      map[k].timed.sort((a, b) => {
        const timeA = a.deadlineAt ? new Date(a.deadlineAt).getTime() : 0
        const timeB = b.deadlineAt ? new Date(b.deadlineAt).getTime() : 0
        return timeA - timeB
      })
    })

    return map
  }, [weekRange, tasks])

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-border-subtle shadow-xs overflow-hidden flex flex-col',
        className,
      )}
    >
      {/* Week Grid Header */}
      <div className="grid grid-cols-7 border-b border-border-subtle bg-slate-50/70 shrink-0">
        {weekRange.days.map((day, idx) => {
          const dayKey = formatDateKey(day)
          const isToday = dayKey === todayKey
          const isSelected = dayKey === selectedKey
          const dayData = tasksByDay[dayKey]
          const totalCount = (dayData?.untimed.length || 0) + (dayData?.timed.length || 0)

          return (
            <div
              key={dayKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                'p-2.5 text-center border-r border-border-subtle/80 last:border-r-0 cursor-pointer transition-colors',
                'hover:bg-slate-100/70',
                isSelected && 'bg-blue-50/60',
              )}
            >
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                {dayNames[idx]}
              </span>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={cn(
                    'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all',
                    isToday
                      ? 'bg-brand-blue text-white shadow-xs'
                      : isSelected
                      ? 'border-2 border-brand-blue text-brand-blue font-bold bg-white'
                      : 'text-slate-800',
                  )}
                >
                  {day.getDate()}
                </span>
                {totalCount > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.2 rounded-full',
                      isToday
                        ? 'bg-blue-100 text-brand-blue'
                        : 'bg-slate-200 text-slate-700',
                    )}
                  >
                    {totalCount}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Week Columns Body */}
      <div className="grid grid-cols-7 min-h-[550px] divide-x divide-border-subtle/80 bg-slate-50/20">
        {weekRange.days.map((day) => {
          const dayKey = formatDateKey(day)
          const dayData = tasksByDay[dayKey] || { untimed: [], timed: [] }
          const isSelected = dayKey === selectedKey
          const totalTasks = dayData.untimed.length + dayData.timed.length

          return (
            <div
              key={dayKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                'p-2 flex flex-col space-y-2 overflow-y-auto max-h-[750px] transition-colors',
                isSelected && 'bg-blue-50/20',
              )}
            >
              {totalTasks === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center opacity-40 select-none">
                  <span className="text-[11px] font-medium text-slate-400">
                    No deadlines
                  </span>
                </div>
              ) : (
                <>
                  {/* Untimed Date-Only Tasks */}
                  {dayData.untimed.length > 0 && (
                    <div className="space-y-1.5 pb-2 border-b border-dashed border-slate-200">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        <Calendar className="w-3 h-3" />
                        <span>Date Only ({dayData.untimed.length})</span>
                      </div>
                      {dayData.untimed.map((task) => (
                        <ScheduleTaskCard key={task.id} task={task} compact />
                      ))}
                    </div>
                  )}

                  {/* Timed Tasks */}
                  {dayData.timed.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      {dayData.untimed.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                          <Clock className="w-3 h-3 text-brand-blue" />
                          <span>Timed ({dayData.timed.length})</span>
                        </div>
                      )}
                      {dayData.timed.map((task) => (
                        <ScheduleTaskCard key={task.id} task={task} compact />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

