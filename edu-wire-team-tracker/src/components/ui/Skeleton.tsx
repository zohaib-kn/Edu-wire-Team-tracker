import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'rounded'
}

export function Skeleton({
  className,
  variant = 'rounded',
  ...props
}: SkeletonProps) {
  const variantClasses = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-inner',
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-slate-200/70',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}

