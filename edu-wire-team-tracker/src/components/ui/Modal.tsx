import { useEffect, type ReactNode } from 'react'
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
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={cn(
          'relative z-10 w-full rounded-card bg-surface border border-border-subtle shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150',
          maxWidthClasses[maxWidth],
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between border-b border-border-subtle px-6 py-5">
            <div>
              {title && (
                <h3 className="text-base font-semibold text-text-primary leading-tight">
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
              className="p-1.5 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
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
      </div>
    </div>
  )
}
