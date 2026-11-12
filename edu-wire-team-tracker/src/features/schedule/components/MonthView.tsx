import { useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  getMonthMatrix,
  formatDateKey,
  formatTimeAMPM,
  formatUTCInTimezone,
  isTaskOverdue,
} from '@/features/tasks/utils/dateUtils'
import type { Task } from '@/features/tasks/types/task.types'

export interface MonthViewProps {
  currentDate: Date
  tasks: Task[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onTaskClick?: (task: Task) => void
  className?: string
}

export function MonthView({
  currentDate,
  tasks,
  selectedDate,
  onSelectDate,
  onTaskClick,
  className,
}: MonthViewProps) {
  const monthMatrix = useMemo(() => getMonthMatrix(currentDate), [currentDate])
  const currentMonthIndex = currentDate.getMonth()
  const todayKey = formatDateKey(new Date())
  const selectedKey = formatDateKey(selectedDate)

  // Map tasks by due date
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {}

    for (const task of tasks) {
      const cleanDue = task.due
        ? task.due.includes('T')
          ? task.due.split('T')[0]
          : task.due
        : ''
      if (!cleanDue) continue

      if (!map[cleanDue]) {
        map[cleanDue] = []
      }
      map[cleanDue].push(task)
    }

    // Sort tasks in each date: timed tasks first, then untimed
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        if (a.deadlineAt && b.deadlineAt) {
          return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime()
        }
        if (a.deadlineAt) return -1
        if (b.deadlineAt) return 1
        return 0
      })
    })

    return map
  }, [tasks])

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-border-subtle shadow-xs overflow-hidden flex flex-col',
        className,
      )}
    >
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-border-subtle bg-slate-50/80 shrink-0">
        {dayNames.map((day) => (
          <div
            key={day}
            className="p-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-border-subtle/80 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Weeks Grid */}
      <div className="flex-1 flex flex-col divide-y divide-border-subtle/80 bg-slate-100/30">
        {monthMatrix.weeks.map((week, weekIdx) => (
          <div
            key={weekIdx}
            className="grid grid-cols-7 flex-1 min-h-[110px] divide-x divide-border-subtle/80 bg-white"
          >
            {week.map((day) => {
              const dayKey = formatDateKey(day)
              const isCurrentMonth = day.getMonth() === currentMonthIndex
              const isToday = dayKey === todayKey
              const isSelected = dayKey === selectedKey
              const dayTasks = tasksByDay[dayKey] || []
              const totalTasks = dayTasks.length
              const visibleTasks = dayTasks.slice(0, 3)
              const remainingCount = totalTasks - visibleTasks.length

              // Check if any incomplete task is overdue
              const hasOverdue = dayTasks.some(
                (t) => t.status !== 'done' && isTaskOverdue(t.due, t.status, t.deadlineAt),
              )

              return (
                <div
                  key={dayKey}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'p-1.5 flex flex-col transition-all cursor-pointer select-none relative group',
                    isCurrentMonth ? 'bg-white' : 'bg-slate-50/60 text-slate-400',
                    isSelected && 'ring-2 ring-inset ring-brand-blue bg-blue-50/20',
                    'hover:bg-slate-50',
                  )}
                >
                  {/* Date Cell Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center transition-all',
                        isToday
                          ? 'bg-brand-blue text-white font-bold shadow-xs'
                          : isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400',
                      )}
                    >
                      {day.getDate()}
                    </span>

                    <div className="flex items-center gap-1">
                      {hasOverdue && (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500"
                          title="Has overdue tasks"
                        />
                      )}
                      {totalTasks > 0 && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1 rounded-full">
                          {totalTasks}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Previews (Capped at 3 to prevent date cell overflow) */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {visibleTasks.map((task) => {
                      const isTaskDone = task.status === 'done'
                      const isTaskDoing = task.status === 'doing'
                      const isTaskLate =
                        !isTaskDone && isTaskOverdue(task.due, task.status, task.deadlineAt)

                      const timeStr = task.deadlineAt
                        ? formatTimeAMPM(
                          formatUTCInTimezone(
                            task.deadlineAt,
                            task.deadlineTimezone || 'Asia/Kolkata',
                          ).time,
                        )
                        : null

                      return (
                        <div
                          key={task.id}
                          role={onTaskClick ? 'button' : undefined}
                          tabIndex={onTaskClick ? 0 : undefined}
                          onClick={(e) => {
                            if (onTaskClick) {
                              e.stopPropagation()
                              onTaskClick(task)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (onTaskClick && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault()
                              e.stopPropagation()
                              onTaskClick(task)
                            }
                          }}
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[11px] font-medium truncate flex items-center gap-1 border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
                            isTaskDone
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 line-through opacity-70'
                              : isTaskLate
                                ? 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
                                : isTaskDoing
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300',
                          )}
                          title={`${task.title}${timeStr ? ` · ${timeStr}` : ''}`}
                        >
                          {/* Status Dot */}
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              isTaskDone
                                ? 'bg-emerald-500'
                                : isTaskLate
                                  ? 'bg-rose-500'
                                  : isTaskDoing
                                    ? 'bg-amber-500'
                                    : 'bg-brand-blue',
                            )}
                          />
                          {timeStr && (
                            <span className="text-[10px] font-bold shrink-0 opacity-80">
                              {timeStr}
                            </span>
                          )}
                          <span className="truncate">{task.title}</span>
                        </div>
                      )
                    })}

                    {/* "+N more" indicator */}
                    {remainingCount > 0 && (
                      <span className="block text-[10px] font-semibold text-brand-blue hover:underline px-1">
                        +{remainingCount} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
