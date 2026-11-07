import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-inner border border-dashed border-border-subtle bg-surface/50',
        className,
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-text-muted mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-text-primary mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

