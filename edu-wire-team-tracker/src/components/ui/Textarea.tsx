import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id: explicitId,
      name,
      label,
      helperText,
      error,
      className,
      rows = 3,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const textareaId = explicitId || name || generatedId
    const errorId = `${textareaId}-error`
    const helperId = `${textareaId}-helper`

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold uppercase tracking-wider text-text-primary mb-1.5"
          >
            {label}
            {props.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full rounded-input bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted/60',
            'border border-border-subtle shadow-card transition-colors',
            'focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20',
            'disabled:bg-slate-50 disabled:text-text-muted disabled:cursor-not-allowed',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className,
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea'
