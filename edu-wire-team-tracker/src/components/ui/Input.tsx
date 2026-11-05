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
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-[#DC2626] ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
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
              'h-10 w-full rounded-lg bg-white px-3 text-sm text-[#0F172A] placeholder:text-slate-400',
              'border border-[#E2E8F0] shadow-xs transition-colors',
              'focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              leftIcon && 'pl-10',
              (rightIcon || (isPasswordType && showPasswordToggle)) && 'pr-10',
              error && 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20',
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
              className="absolute right-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {isPasswordVisible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          ) : rightIcon ? (
            <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
              {rightIcon}
            </div>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-xs text-[#DC2626]">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1 text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'

