import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface TaskDetailModalProps {
  isOpen: boolean
  onClose: () => void
  ariaLabel?: string
  titleId?: string
  pauseDismiss?: boolean
  children: ReactNode
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      el.getClientRects().length > 0 &&
      window.getComputedStyle(el).visibility !== 'hidden',
  )
}

function isTopmostDialog(dialogEl: HTMLElement | null): boolean {
  if (!dialogEl) return false
  const openDialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
  return openDialogs.length > 0 && openDialogs[openDialogs.length - 1] === dialogEl
}

/**
 * Centered Jira-inspired modal overlay shell for Desktop/Tablet and
 * full-screen workspace shell on Mobile.
 */
export function TaskDetailModal({
  isOpen,
  onClose,
  ariaLabel = 'Task details workspace',
  titleId,
  pauseDismiss = false,
  children,
}: TaskDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const pauseDismissRef = useRef(pauseDismiss)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    pauseDismissRef.current = pauseDismiss
  }, [pauseDismiss])

  useEffect(() => {
    if (!isOpen) return undefined

    previousFocusRef.current = document.activeElement as HTMLElement | null
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.requestAnimationFrame(() => {
      if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
        dialogRef.current.focus()
      }
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pauseDismissRef.current || !isTopmostDialog(dialogRef.current)) {
        return
      }

      if (event.key === 'Escape') {
        if (event.defaultPrevented) return
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current)
        if (focusables.length === 0) {
          event.preventDefault()
          dialogRef.current.focus()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (event.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            event.preventDefault()
            last.focus()
          }
        } else if (!active || active === last || !dialogRef.current.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleKeyDown)

      const returnTarget = previousFocusRef.current
      if (returnTarget && returnTarget.isConnected) {
        window.requestAnimationFrame(() => {
          returnTarget.focus()
        })
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : ariaLabel}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-40 flex items-stretch justify-center md:items-center md:p-6 lg:p-10 outline-none"
    >
      {/* Dimmed backdrop overlay keeping sidebar & underlying page visible */}
      <div
        className="fixed inset-0 bg-slate-900/45 transition-opacity"
        onClick={() => {
          if (!pauseDismissRef.current && isTopmostDialog(dialogRef.current)) {
            onClose()
          }
        }}
        aria-hidden="true"
      />

      {/* Modal surface container: full-screen on mobile, centered 1360px workspace on desktop */}
      <div className="relative z-10 flex flex-col w-full h-dvh md:w-[min(1360px,calc(100vw-48px))] lg:w-[min(1360px,calc(100vw-80px))] md:h-[min(90vh,920px)] bg-surface rounded-none md:rounded-[12px] border-0 md:border md:border-border-subtle md:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.14),0_4px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
        {children}
      </div>
    </div>,
    document.body,
  )
}

