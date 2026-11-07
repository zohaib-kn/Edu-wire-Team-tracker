import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { loginSchema, type LoginFormValues } from '../schemas/authSchemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

export interface LoginFormProps {
  isDark?: boolean
}

export function LoginForm({ isDark = false }: LoginFormProps = {}) {
  const { login } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onTouched',
  })

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    try {
      await login(values)
      // Redirect is handled reactively by GuestRoute / ProtectedRoute in AuthProvider state
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message)
      } else {
        setFormError('Failed to sign in. Please verify your credentials and try again.')
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
    >
      {formError && (
        <Alert variant="error" title="Sign In Failed">
          {formError}
        </Alert>
      )}

      <div>
        <Input
          {...register('email')}
          id="email"
          type="email"
          label="Email Address"
          placeholder="name@company.com"
          autoComplete="email"
          autoFocus
          required
          leftIcon={<Mail className="w-4 h-4" />}
          error={errors.email?.message}
          disabled={isSubmitting}
          isDark={isDark}
        />
      </div>

      <div>
        <Input
          {...register('password')}
          id="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          showPasswordToggle
          leftIcon={<Lock className="w-4 h-4" />}
          error={errors.password?.message}
          disabled={isSubmitting}
          isDark={isDark}
        />
      </div>

      <div className="pt-1.5">
        <Button
          type="submit"
          fullWidth
          size="lg"
          isLoading={isSubmitting}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </Button>
      </div>
    </form>
  )
}

