import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  getMonthMatrix,
  formatMonthYear,
  formatDateKey,
  addMonths,
} from '@/features/tasks/utils/dateUtils'

export interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  taskDatesSet?: Set<string>
  className?: string
}

export function MiniCalendar({
  selectedDate,
  onSelectDate,
  taskDatesSet = new Set(),
  className,
}: MiniCalendarProps) {
  const [activeMonthDate, setActiveMonthDate] = useState<Date>(
    new Date(selectedDate),
  )

  const monthMatrix = getMonthMatrix(activeMonthDate)
  const currentMonthIndex = activeMonthDate.getMonth()
  const todayKey = formatDateKey(new Date())
  const selectedKey = formatDateKey(selectedDate)

  const handlePrevMonth = () => {
    setActiveMonthDate((prev) => addMonths(prev, -1))
  }

  const handleNextMonth = () => {
    setActiveMonthDate((prev) => addMonths(prev, 1))
  }

  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div
      className={cn(
        'p-3.5 bg-white rounded-xl border border-border-subtle shadow-xs select-none',
        className,
      )}
    >
      {/* Header: Month Year & Navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h4 className="text-xs font-bold text-slate-900 tracking-tight">
          {formatMonthYear(activeMonthDate)}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {dayNames.map((day, idx) => (
          <span
            key={idx}
            className="text-[11px] font-semibold text-slate-400 py-1"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="space-y-1">
        {monthMatrix.weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const dayKey = formatDateKey(day)
              const isCurrentMonth = day.getMonth() === currentMonthIndex
              const isToday = dayKey === todayKey
              const isSelected = dayKey === selectedKey
              const hasTasks = taskDatesSet.has(dayKey)

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'h-7 w-7 mx-auto rounded-lg text-xs font-medium flex flex-col items-center justify-center relative transition-all cursor-pointer',
                    isSelected
                      ? 'bg-brand-blue text-white font-bold shadow-xs'
                      : isToday
                      ? 'border border-brand-blue text-brand-blue font-bold bg-blue-50/50'
                      : isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100'
                      : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50',
                  )}
                >
                  <span>{day.getDate()}</span>
                  {/* Task indicator dot */}
                  {hasTasks && !isSelected && (
                    <span
                      className={cn(
                        'w-1 h-1 rounded-full absolute bottom-0.5',
                        isToday ? 'bg-brand-blue' : 'bg-slate-400',
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

