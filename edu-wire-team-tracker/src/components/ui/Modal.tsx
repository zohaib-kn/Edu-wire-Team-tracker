import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  triggerRef?: RefObject<HTMLElement | null>
  ariaLabel?: string
  ariaLabelledBy?: string
  containerClassName?: string
  backdropClassName?: string
  panelClassName?: string
  unwrapped?: boolean
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

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  triggerRef,
  ariaLabel,
  ariaLabelledBy,
  containerClassName,
  backdropClassName,
  panelClassName,
  unwrapped = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const fallbackTitleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return undefined

    const triggerEl = triggerRef?.current ?? null
    previousFocusRef.current =
      (triggerEl as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.requestAnimationFrame(() => {
      if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
        dialogRef.current.focus()
      }
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmostDialog(dialogRef.current)) return

      if (e.key === 'Escape') {
        if (e.defaultPrevented) return
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current)
        if (focusables.length === 0) {
          e.preventDefault()
          dialogRef.current.focus()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (e.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else if (!active || active === last || !dialogRef.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)

      const returnTarget = triggerEl ?? previousFocusRef.current
      if (returnTarget && returnTarget.isConnected) {
        window.requestAnimationFrame(() => {
          if (!returnTarget.isConnected) return
          const openDialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
          const topDialog =
            openDialogs.length > 0 ? openDialogs[openDialogs.length - 1] : null
          // Only restore focus to the trigger when closing back to its owning context
          if (!topDialog || topDialog.contains(returnTarget)) {
            returnTarget.focus()
          }
        })
      }
    }
  }, [isOpen, triggerRef])

  if (!isOpen) return null

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  const resolvedLabelledBy = ariaLabelledBy ?? (title ? fallbackTitleId : undefined)

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={resolvedLabelledBy}
      aria-label={resolvedLabelledBy ? undefined : ariaLabel}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 outline-none',
        containerClassName,
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity',
          backdropClassName,
        )}
        onClick={() => {
          if (isTopmostDialog(dialogRef.current)) {
            onClose()
          }
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Surface */}
      <div
        className={cn(
          'relative z-10',
          panelClassName ??
            cn(
              'w-full rounded-card bg-surface border border-border-subtle shadow-xl overflow-hidden',
              maxWidthClasses[maxWidth],
            ),
        )}
      >
        {unwrapped ? (
          children
        ) : (
          <>
            {(title || description) && (
              <div className="flex items-start justify-between border-b border-border-subtle px-6 py-5">
                <div>
                  {title && (
                    <h3
                      id={fallbackTitleId}
                      className="text-base font-semibold text-text-primary leading-tight"
                    >
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="mt-1 text-xs text-text-muted leading-normal">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-1.5 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="p-6">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2.5 border-t border-border-subtle bg-slate-50/60 px-6 py-4">
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
