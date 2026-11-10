import { AppError } from './AppError.js'

/**
 * Utility functions for date calculations in the Asia/Kolkata (IST) timezone.
 */

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in Asia/Kolkata timezone.
 */
export function getTodayDateIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date()) // Produces 'YYYY-MM-DD'
}

/**
 * Returns the date threshold for '7 days ago' in Asia/Kolkata.
 */
export function getSevenDaysAgoIST(): Date {
  const now = new Date()
  // Subtract 7 days (7 * 24 hours)
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
}

/**
 * Validates whether a string matches the 'YYYY-MM-DD' date format.
 */
export function isValidDateOnlyString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false
  }
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

/**
 * Checks if a string is a valid, supported IANA timezone.
 */
export function isValidTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * Validates whether a string matches the 24-hour time format 'HH:mm' (00:00 - 23:59).
 */
export function isValidTimeString(timeStr: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)
}

/**
 * Parses a local calendar date (YYYY-MM-DD) and local time (HH:mm) in a given IANA timezone
 * and calculates the corresponding exact UTC Date instant.
 * Does not rely on the browser/host operating system timezone.
 */
export function parseLocalDateTimeToUTC(
  dateStr: string,
  timeStr: string,
  timeZone: string = 'Asia/Kolkata',
): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)

  // Use approximate UTC instant to probe the timezone offset at that particular instant
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute))

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(approx)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value

  let fHour = parseInt(map.hour, 10)
  if (fHour === 24) fHour = 0

  const localAsUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    fHour,
    parseInt(map.minute, 10),
    parseInt(map.second, 10),
  )

  const offsetMs = localAsUtc - approx.getTime()
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMs
  return new Date(utcMs)
}

/**
 * Formats a UTC Date into local calendar date (YYYY-MM-DD) and local time (HH:mm)
 * in the specified timezone.
 */
export function formatUTCInTimezone(
  utcDate: Date | string | number,
  timeZone: string = 'Asia/Kolkata',
): { date: string; time: string } {
  const dateObj = typeof utcDate === 'string' || typeof utcDate === 'number' ? new Date(utcDate) : utcDate
  if (isNaN(dateObj.getTime())) {
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

  const parts = formatter.formatToParts(dateObj)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value

  let hour = map.hour === '24' ? '00' : map.hour
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${map.minute}`,
  }
}

export interface DeadlineResolutionInput {
  due: string
  deadlineTime?: string | null
  deadlineAt?: Date | string | null
  deadlineTimezone?: string
  reminderMinutesBefore?: number | null
}

export interface ResolvedDeadline {
  due: string
  deadlineAt: Date | null
  deadlineTimezone: string
  reminderMinutesBefore: number | null
}

/**
 * Validates and resolves incoming task deadline data:
 * - Validates date format (YYYY-MM-DD)
 * - Validates local time format (HH:mm) if provided
 * - Validates supported IANA timezone (defaults to Asia/Kolkata)
 * - Checks consistency between `due` and `deadlineAt`
 * - Validates reminder preference (30, 60, or null/0)
 * - Optionally checks that new task deadlines are not in the past
 */
export function resolveDeadlineInput(
  input: DeadlineResolutionInput,
  options?: { isNewTask?: boolean },
): ResolvedDeadline {
  const { due } = input
  if (!isValidDateOnlyString(due)) {
    throw AppError.badRequest('Due date must be in YYYY-MM-DD format', 'INVALID_DUE_DATE')
  }

  const timezone = (input.deadlineTimezone || 'Asia/Kolkata').trim()
  if (!isValidTimezone(timezone)) {
    throw AppError.badRequest(`Unsupported or invalid timezone: '${timezone}'`, 'INVALID_TIMEZONE')
  }

  let finalDeadlineAt: Date | null = null

  if (input.deadlineTime && input.deadlineTime.trim()) {
    const cleanTime = input.deadlineTime.trim()
    if (!isValidTimeString(cleanTime)) {
      throw AppError.badRequest('Deadline time must be in HH:mm format (00:00 to 23:59)', 'INVALID_TIME_FORMAT')
    }
    finalDeadlineAt = parseLocalDateTimeToUTC(due, cleanTime, timezone)

    // If client also supplied deadlineAt, check consistency
    if (input.deadlineAt) {
      const explicitDate = new Date(input.deadlineAt)
      if (isNaN(explicitDate.getTime())) {
        throw AppError.badRequest('Invalid deadlineAt timestamp', 'INVALID_DEADLINE_TIMESTAMP')
      }
      // Allow +/- 60 seconds tolerance for rounding
      if (Math.abs(explicitDate.getTime() - finalDeadlineAt.getTime()) > 60000) {
        throw AppError.badRequest(
          'deadlineAt timestamp contradicts due date and deadline time in selected timezone',
          'CONTRADICTORY_DEADLINE',
        )
      }
    }
  } else if (input.deadlineAt) {
    const explicitDate = new Date(input.deadlineAt)
    if (isNaN(explicitDate.getTime())) {
      throw AppError.badRequest('Invalid deadlineAt timestamp', 'INVALID_DEADLINE_TIMESTAMP')
    }
    // Verify consistency: local date in target timezone must match `due`
    const local = formatUTCInTimezone(explicitDate, timezone)
    if (local.date !== due) {
      throw AppError.badRequest(
        `deadlineAt date (${local.date}) does not match due date (${due}) in timezone ${timezone}`,
        'CONTRADICTORY_DEADLINE',
      )
    }
    finalDeadlineAt = explicitDate
  }

  // Validate reminder preference
  let reminderMinutesBefore: number | null = null
  if (finalDeadlineAt) {
    if (input.reminderMinutesBefore !== undefined && input.reminderMinutesBefore !== null) {
      const r = Number(input.reminderMinutesBefore)
      if (r === 0) {
        reminderMinutesBefore = null
      } else if (r === 30 || r === 60) {
        reminderMinutesBefore = r
      } else {
        throw AppError.badRequest(
          'Reminder must be 30 minutes before, 60 minutes before, or no advance reminder',
          'INVALID_REMINDER_SETTING',
        )
      }
    } else {
      // Default to 30 minutes before for tasks with exact deadlines
      reminderMinutesBefore = 30
    }

    // Past deadline check for new tasks
    if (options?.isNewTask) {
      if (finalDeadlineAt.getTime() < Date.now()) {
        throw AppError.badRequest('Deadline cannot be in the past', 'DEADLINE_IN_PAST')
      }
    }
  } else {
    // Legacy date-only task: no minute-specific reminder
    reminderMinutesBefore = null
  }

  return {
    due,
    deadlineAt: finalDeadlineAt,
    deadlineTimezone: timezone,
    reminderMinutesBefore,
  }
}
