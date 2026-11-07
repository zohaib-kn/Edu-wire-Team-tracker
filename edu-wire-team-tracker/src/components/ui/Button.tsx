import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from './Spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-nav transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

    const sizeClasses = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-base gap-2.5',
    }

    const variantClasses = {
      primary:
        'bg-brand-blue hover:bg-brand-blue-hover text-white shadow-card focus-visible:ring-brand-blue/30',
      secondary:
        'bg-slate-100 hover:bg-slate-200 text-text-primary focus-visible:ring-slate-300',
      outline:
        'bg-surface border border-border-subtle hover:bg-slate-50 text-text-primary shadow-card focus-visible:ring-brand-blue/30',
      ghost:
        'bg-transparent hover:bg-slate-100 text-text-muted hover:text-text-primary focus-visible:ring-slate-200',
      danger:
        'bg-destructive hover:bg-destructive-hover text-white shadow-card focus-visible:ring-destructive/30',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Spinner size={size === 'sm' ? 'sm' : 'md'} />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
