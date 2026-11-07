import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  options?: SelectOption[]
  children?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id: explicitId,
      name,
      label,
      helperText,
      error,
      className,
      options,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const selectId = explicitId || name || generatedId
    const errorId = `${selectId}-error`
    const helperId = `${selectId}-helper`

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1.5"
          >
            {label}
            {props.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            name={name}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'h-10 w-full rounded-input bg-surface pl-3 pr-10 text-sm text-text-primary',
              'border border-border-subtle shadow-card transition-colors appearance-none cursor-pointer',
              'focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20',
              'disabled:bg-slate-50 disabled:text-text-muted disabled:cursor-not-allowed',
              error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
              className,
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute right-3 flex items-center text-text-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1 text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  },
)

Select.displayName = 'Select'
