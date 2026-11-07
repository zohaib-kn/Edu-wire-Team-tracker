import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  showPasswordToggle?: boolean
  isDark?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id: explicitId,
      name,
      label,
      helperText,
      error,
      type = 'text',
      className,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      disabled,
      isDark = false,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = explicitId || name || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    const isPasswordType = type === 'password'
    const actualType =
      isPasswordType && showPasswordToggle
        ? isPasswordVisible
          ? 'text'
          : 'password'
        : type

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-xs font-semibold uppercase tracking-wider mb-2',
              isDark ? 'text-slate-300' : 'text-text-primary',
            )}
          >
            {label}
            {props.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className={cn(
                'absolute left-3 flex items-center pointer-events-none',
                isDark ? 'text-slate-400' : 'text-text-muted',
              )}
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={actualType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              'h-10 w-full rounded-input px-3 text-sm transition-colors',
              isDark
                ? 'bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-500 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 disabled:bg-slate-900 disabled:text-slate-500'
                : 'bg-surface border border-border-subtle shadow-card text-text-primary placeholder:text-text-muted/60 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:bg-slate-50 disabled:text-text-muted',
              leftIcon && 'pl-10',
              (rightIcon || (isPasswordType && showPasswordToggle)) && 'pr-10',
              error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
              className,
            )}
            {...props}
          />

          {isPasswordType && showPasswordToggle ? (
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              tabIndex={-1}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              className={cn(
                'absolute right-3 flex items-center focus:outline-none cursor-pointer',
                isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              {isPasswordVisible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          ) : rightIcon ? (
            <div
              className={cn(
                'absolute right-3 flex items-center pointer-events-none',
                isDark ? 'text-slate-400' : 'text-text-muted',
              )}
            >
              {rightIcon}
            </div>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : helperText ? (
          <p
            id={helperId}
            className={cn(
              'mt-1.5 text-xs',
              isDark ? 'text-slate-400' : 'text-text-muted',
            )}
          >
            {helperText}
          </p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'
