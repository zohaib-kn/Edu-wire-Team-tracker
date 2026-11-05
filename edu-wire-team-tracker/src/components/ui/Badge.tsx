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
    primary: 'bg-blue-50 text-[#1D4ED8] border-blue-200',
    success: 'bg-green-50 text-[#16A34A] border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-[#DC2626] border-red-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
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

