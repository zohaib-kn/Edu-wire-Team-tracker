import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface AlertProps {
  variant?: 'error' | 'warning' | 'success' | 'info'
  title?: string
  children: ReactNode
  className?: string
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: AlertProps) {
  const variantStyles = {
    error: {
      container: 'bg-tint-red-bg border-tint-red-border text-tint-red-text',
      icon: <AlertCircle className="w-5 h-5 text-destructive shrink-0" />,
    },
    warning: {
      container: 'bg-tint-amber-bg border-tint-amber-border text-tint-amber-text',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    },
    success: {
      container: 'bg-tint-green-bg border-tint-green-border text-tint-green-text',
      icon: <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />,
    },
    info: {
      container: 'bg-tint-blue-bg border-tint-blue-border text-tint-blue-text',
      icon: <Info className="w-5 h-5 text-brand-blue shrink-0" />,
    },
  }

  const current = variantStyles[variant]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-inner border text-sm',
        current.container,
        className,
      )}
    >
      {current.icon}
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold mb-0.5 leading-snug">{title}</h4>}
        <div className="text-xs sm:text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
