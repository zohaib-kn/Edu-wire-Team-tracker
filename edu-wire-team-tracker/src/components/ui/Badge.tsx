import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
  size?: 'sm' | 'md'
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  className,
  children,
  ...props
}: BadgeProps) {
  const variantClasses = {
    primary: 'bg-tint-blue-bg text-tint-blue-text border-tint-blue-border',
    success: 'bg-tint-green-bg text-tint-green-text border-tint-green-border',
    warning: 'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border',
    error: 'bg-tint-red-bg text-tint-red-text border-tint-red-border',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-badge border transition-colors',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
