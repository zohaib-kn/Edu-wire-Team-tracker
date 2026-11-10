/**
 * Date and deadline handling adhering strictly to the Asia/Kolkata timezone rule.
 * Tasks support both legacy date-only values (YYYY-MM-DD) and exact deadline instants (deadlineAt).
 */

export function getTodayDateStringKolkata(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(new Date()) // Returns 'YYYY-MM-DD'
  } catch {
    // Fallback to local YYYY-MM-DD if Intl fails
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Formats a YYYY-MM-DD date string into a clean, readable date (e.g. 'Nov 12, 2026').
 */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No due date'
  // Handle if backend returned ISO string with time component
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const parts = cleanStr.split('-')
  if (parts.length !== 3) return dateStr

  const year = parseInt(parts[0], 10)
  const monthIndex = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) return dateStr

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  return `${day} ${monthNames[monthIndex]} ${year}`
}

/**
 * Formats a 24-hour time string 'HH:mm' into a 12-hour AM/PM string (e.g. '5:00 PM').
 */
export function formatTimeAMPM(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  if (isNaN(hour)) return timeStr

  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12

  return `${hour}:${minute} ${ampm}`
}

/**
 * Formats an exact deadline instant into display string:
 * e.g. "12 Nov 2026 · 5:00 PM IST"
 * If deadlineAt is not provided, falls back to date-only formatting.
 */
export function formatDeadline(
  deadlineAt: string | Date | null | undefined,
  timeZone: string = 'Asia/Kolkata',
  fallbackDue?: string | null,
): string {
  if (!deadlineAt) {
    return formatDateOnly(fallbackDue)
  }

  const date = typeof deadlineAt === 'string' ? new Date(deadlineAt) : deadlineAt
  if (isNaN(date.getTime())) {
    return formatDateOnly(fallbackDue)
  }

  // Format date part
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const dateStr = dateFormatter.format(date) // e.g. "12 Nov 2026"

  // Format time part
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const timeStr = timeFormatter.format(date) // e.g. "5:00 PM"

  const tzAbbr = timeZone === 'Asia/Kolkata' ? 'IST' : timeZone

  return `${dateStr} · ${timeStr} ${tzAbbr}`
}

/**
 * Extracts local date (YYYY-MM-DD) and local time (HH:mm) in a timezone from a UTC Date or ISO string.
 */
export function formatUTCInTimezone(
  utcDate: Date | string,
  timeZone: string = 'Asia/Kolkata',
): { date: string; time: string } {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  if (isNaN(d.getTime())) {
    return { date: '', time: '' }
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value

  let hour = map.hour === '24' ? '00' : map.hour
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${map.minute}`,
  }
}

/**
 * Returns true if the task is not completed and its deadline has passed:
 * - For timed tasks: deadlineAt < Date.now()
 * - For date-only tasks: due < today in Asia/Kolkata
 */
export function isTaskOverdue(
  dueDate: string | null | undefined,
  status: string,
  deadlineAt?: string | Date | null,
): boolean {
  if (!dueDate || status === 'done') return false
  if (deadlineAt) {
    const d = typeof deadlineAt === 'string' ? new Date(deadlineAt) : deadlineAt
    if (!isNaN(d.getTime())) {
      return d.getTime() < Date.now()
    }
  }
  const cleanDue = dueDate.includes('T') ? dueDate.split('T')[0] : dueDate
  const today = getTodayDateStringKolkata()
  return cleanDue < today
}

/**
 * Returns true if the task is not completed and due today without being overdue:
 * - For timed tasks: due is today and deadlineAt >= Date.now()
 * - For date-only tasks: due is today in Asia/Kolkata
 */
export function isTaskDueToday(
  dueDate: string | null | undefined,
  status: string,
  deadlineAt?: string | Date | null,
): boolean {
  if (!dueDate || status === 'done') return false
  const cleanDue = dueDate.includes('T') ? dueDate.split('T')[0] : dueDate
  const today = getTodayDateStringKolkata()
  if (cleanDue !== today) return false

  if (deadlineAt) {
    const d = typeof deadlineAt === 'string' ? new Date(deadlineAt) : deadlineAt
    if (!isNaN(d.getTime())) {
      return d.getTime() >= Date.now()
    }
  }
  return true
}

/**
 * Returns a human-friendly due badge label (e.g. 'Overdue', 'Due Today', 'Due Tomorrow', 'Oct 25').
 */
export function getDueStatusLabel(
  dueDate: string | null | undefined,
  status: string,
  deadlineAt?: string | Date | null,
): {
  label: string
  isOverdue: boolean
  isToday: boolean
} {
  if (!dueDate) {
    return { label: 'No due date', isOverdue: false, isToday: false }
  }

  const cleanDue = dueDate.includes('T') ? dueDate.split('T')[0] : dueDate
  const isOverdue = isTaskOverdue(dueDate, status, deadlineAt)
  const isToday = isTaskDueToday(dueDate, status, deadlineAt)

  if (status === 'done') {
    return { label: formatDateOnly(cleanDue), isOverdue: false, isToday: false }
  }

  if (isOverdue) {
    return { label: `Overdue (${formatDateOnly(cleanDue)})`, isOverdue: true, isToday: false }
  }

  if (isToday) {
    return { label: 'Due Today', isOverdue: false, isToday: true }
  }

  return { label: formatDateOnly(cleanDue), isOverdue: false, isToday: false }
}

/**
 * Converts a Date object to YYYY-MM-DD string in Asia/Kolkata timezone.
 */
export function formatDateKey(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(date)
  } catch {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Creates a Date object from YYYY-MM-DD string at local midnight.
 */
export function parseDateKey(dateStr: string): Date {
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const parts = cleanStr.split('-')
  if (parts.length !== 3) return new Date()
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  return new Date(year, month, day, 12, 0, 0)
}

/**
 * Safely adds or subtracts days from a Date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Safely adds or subtracts months from a Date.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Returns the Monday-to-Sunday 7-day range for the week containing `targetDate`.
 */
export function getWeekRange(targetDate: Date): {
  start: Date
  end: Date
  startDateStr: string
  endDateStr: string
  days: Date[]
} {
  const d = new Date(targetDate)
  // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOfWeek = d.getDay()
  // Offset to previous Monday (if Sunday (0), offset is -6; if Monday (1), offset is 0)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = addDays(d, diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    days.push(addDays(monday, i))
  }

  const sunday = days[6]
  sunday.setHours(23, 59, 59, 999)

  return {
    start: monday,
    end: sunday,
    startDateStr: formatDateKey(monday),
    endDateStr: formatDateKey(sunday),
    days,
  }
}

/**
 * Returns a complete calendar grid matrix (array of 7-day weeks) for the month containing `targetDate`.
 * Weeks start on Monday. Days from previous and next months pad the matrix.
 */
export function getMonthMatrix(targetDate: Date): {
  startDateStr: string
  endDateStr: string
  weeks: Date[][]
} {
  const year = targetDate.getFullYear()
  const monthIndex = targetDate.getMonth()

  // First day of the month
  const firstOfMonth = new Date(year, monthIndex, 1)
  const lastOfMonth = new Date(year, monthIndex + 1, 0)

  // Start with the Monday of the week containing the first of month
  const weekRangeFirst = getWeekRange(firstOfMonth)
  const firstGridDay = weekRangeFirst.days[0]

  // End with the Sunday of the week containing the last of month
  const weekRangeLast = getWeekRange(lastOfMonth)
  const lastGridDay = weekRangeLast.days[6]

  const weeks: Date[][] = []
  let currentDay = new Date(firstGridDay)

  while (currentDay <= lastGridDay || weeks.length < 5) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(currentDay))
      currentDay = addDays(currentDay, 1)
    }
    weeks.push(week)
    if (currentDay > lastGridDay && weeks.length >= 5) {
      break
    }
  }

  return {
    startDateStr: formatDateKey(firstGridDay),
    endDateStr: formatDateKey(lastGridDay),
    weeks,
  }
}

/**
 * Formats Month and Year (e.g. "November 2026").
 */
export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Formats Week range for header (e.g. "Nov 9 – 15, 2026" or "Nov 30 – Dec 6, 2026").
 */
export function formatWeekRangeHeader(startDate: Date, endDate: Date): string {
  const startMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(startDate)
  const endMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(endDate)
  const startDay = startDate.getDate()
  const endDay = endDate.getDate()
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  if (startYear !== endYear) {
    return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
  }
  if (startMonth !== endMonth) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`
  }
  return `${startMonth} ${startDay} – ${endDay}, ${startYear}`
}

/**
 * Formats full day header (e.g. "Monday, Nov 9, 2026").
 */
export function formatDayHeaderLong(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * Formats an hour index (0..23) into clean AM/PM label (e.g. 9 -> "9:00 AM", 17 -> "5:00 PM").
 */
export function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:00 ${ampm}`
}

