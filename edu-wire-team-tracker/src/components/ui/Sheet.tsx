import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const openDialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
        if (openDialogs.length > 0 && openDialogs[openDialogs.length - 1] !== sheetRef.current) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding Sheet Panel */}
      <div
        className={cn(
          'relative z-10 flex flex-col w-full sm:max-w-lg h-full bg-surface border-l border-border-subtle shadow-2xl overflow-hidden',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-5 shrink-0">
          <div>
            {title && (
              <h2 id={titleId} className="text-base font-semibold text-text-primary tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-text-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            className="p-1.5 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Sticky Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-border-subtle bg-slate-50/80 px-6 py-4 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
