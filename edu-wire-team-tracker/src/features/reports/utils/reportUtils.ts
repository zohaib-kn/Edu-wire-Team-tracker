/**
 * Returns formatted date context in Asia/Kolkata timezone.
 */
export function getCurrentReportingDateContext(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return `${formatter.format(new Date())} • Asia/Kolkata (IST)`
  } catch {
    return 'Asia/Kolkata (IST)'
  }
}

/**
 * Computes completion rate percentage safely.
 */
export function calculateCompletionRate(completed: number, pending: number): number {
  const total = completed + pending
  if (total <= 0) return 0
  return Math.round((completed / total) * 100)
}

/**
 * Copies plain text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

