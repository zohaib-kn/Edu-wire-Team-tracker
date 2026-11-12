import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Check, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '../schemas/authSchemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

export function ChangePasswordForm() {
  const { user, changePassword, logout } = useAuth()
  const isForced = Boolean(user?.mustChangePassword)
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  })

  const newPasswordValue = useWatch({ control, name: 'newPassword' }) || ''
  const hasMinLength = newPasswordValue.length >= 8
  const hasLetter = /[A-Za-z]/.test(newPasswordValue)
  const hasNumber = /\d/.test(newPasswordValue)

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setFormError(null)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setIsSuccess(true)
      // Navigate to dashboard once server confirmation has refreshed the user state
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 1000)
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message)
      } else {
        setFormError('Failed to change password. Please check your current password and try again.')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && (
        <Alert variant="error" title="Password Update Failed">
          {formError}
        </Alert>
      )}

      {isSuccess && (
        <Alert variant="success" title="Password Updated Successfully">
          Your password has been changed. Redirecting to your dashboard...
        </Alert>
      )}

      <div>
        <Input
          {...register('currentPassword')}
          id="currentPassword"
          type="password"
          label={isForced ? 'Current Temporary Password' : 'Current Password'}
          placeholder="Enter current password"
          autoComplete="current-password"
          autoFocus
          required
          showPasswordToggle
          leftIcon={<KeyRound className="w-4 h-4" />}
          error={errors.currentPassword?.message}
          disabled={isSubmitting || isSuccess}
        />
      </div>

      <div>
        <Input
          {...register('newPassword')}
          id="newPassword"
          type="password"
          label="New Password"
          placeholder="Enter new password"
          autoComplete="new-password"
          required
          showPasswordToggle
          leftIcon={<Lock className="w-4 h-4" />}
          error={errors.newPassword?.message}
          disabled={isSubmitting || isSuccess}
        />
      </div>

      {/* Password requirements checklist */}
      <div className="rounded-lg bg-slate-50 border border-[#E2E8F0] p-3 text-xs space-y-1.5 text-slate-600">
        <span className="font-semibold text-slate-700 block mb-1">
          Password requirements:
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasMinLength
                ? 'bg-green-100 text-[#16A34A]'
                : 'bg-slate-200 text-slate-500'
              }`}
          >
            <Check className="w-3 h-3" />
          </span>
          <span className={hasMinLength ? 'text-slate-900 font-medium' : ''}>
            Minimum 8 characters
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasLetter
                ? 'bg-green-100 text-[#16A34A]'
                : 'bg-slate-200 text-slate-500'
              }`}
          >
            <Check className="w-3 h-3" />
          </span>
          <span className={hasLetter ? 'text-slate-900 font-medium' : ''}>
            Contains at least one letter
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasNumber
                ? 'bg-green-100 text-[#16A34A]'
                : 'bg-slate-200 text-slate-500'
              }`}
          >
            <Check className="w-3 h-3" />
          </span>
          <span className={hasNumber ? 'text-slate-900 font-medium' : ''}>
            Contains at least one number
          </span>
        </div>
      </div>

      <div>
        <Input
          {...register('confirmPassword')}
          id="confirmPassword"
          type="password"
          label="Confirm New Password"
          placeholder="Re-enter new password"
          autoComplete="new-password"
          required
          showPasswordToggle
          leftIcon={<Lock className="w-4 h-4" />}
          error={errors.confirmPassword?.message}
          disabled={isSubmitting || isSuccess}
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          fullWidth
          size="lg"
          isLoading={isSubmitting}
          disabled={isSuccess}
        >
          {isSubmitting
            ? 'Updating Password...'
            : isForced
              ? 'Set New Password & Continue'
              : 'Update Password'}
        </Button>
      </div>

      <div className="pt-2 text-center">
        {isForced ? (
          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-slate-500 hover:text-[#DC2626] font-medium transition-colors cursor-pointer"
          >
            Sign out and return later
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    </form>
  )
}
