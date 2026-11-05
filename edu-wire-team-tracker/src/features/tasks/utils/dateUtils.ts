/**
 * Date handling adhering strictly to the Asia/Kolkata timezone rule.
 * Tasks use date-only values (YYYY-MM-DD), avoiding UTC conversion shifts.
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
 * Formats a YYYY-MM-DD date string into a clean, readable date.
 * Does not parse through new Date(iso) to prevent timezone drift.
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

  return `${monthNames[monthIndex]} ${day}, ${year}`
}

/**
 * Returns true if the task is not completed and its due date is before today in Asia/Kolkata.
 */
export function isTaskOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'done') return false
  const cleanDue = dueDate.includes('T') ? dueDate.split('T')[0] : dueDate
  const today = getTodayDateStringKolkata()
  return cleanDue < today
}

/**
 * Returns true if the task is not completed and its due date is exactly today in Asia/Kolkata.
 */
export function isTaskDueToday(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'done') return false
  const cleanDue = dueDate.includes('T') ? dueDate.split('T')[0] : dueDate
  const today = getTodayDateStringKolkata()
  return cleanDue === today
}

/**
 * Returns a human-friendly due badge label (e.g. 'Overdue', 'Due Today', 'Due Tomorrow', 'Oct 25').
 */
export function getDueStatusLabel(dueDate: string | null | undefined, status: string): {
  label: string
  isOverdue: boolean
  isToday: boolean
} {
  if (!dueDate) {
    return { label: 'No due date', isOverdue: false, isToday: false }
  }

  const cleanDue = dueDate.includes('T') ? dueDate.split('T')[0] : dueDate
  const today = getTodayDateStringKolkata()

  if (status === 'done') {
    return { label: formatDateOnly(cleanDue), isOverdue: false, isToday: false }
  }

  if (cleanDue < today) {
    return { label: `Overdue (${formatDateOnly(cleanDue)})`, isOverdue: true, isToday: false }
  }

  if (cleanDue === today) {
    return { label: 'Due Today', isOverdue: false, isToday: true }
  }

  return { label: formatDateOnly(cleanDue), isOverdue: false, isToday: false }
}

