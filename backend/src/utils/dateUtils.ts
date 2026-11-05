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

