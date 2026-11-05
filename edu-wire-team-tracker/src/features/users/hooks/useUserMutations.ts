import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { userService } from '../services/userService'
import { userKeys } from './queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import type {
  CreateUserPayload,
  ManagedUser,
  ResetPasswordResponse,
  UpdateUserPayload,
} from '../types/userAdmin.types'

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation<ManagedUser, Error, CreateUserPayload>({
    mutationFn: (payload) => userService.createUser(payload),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
      toast.success('User account created', {
        description: `Account for "${newUser.name}" has been created.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to create user', {
        description: parsed.message,
      })
    },
  })
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient()

  return useMutation<ManagedUser, Error, UpdateUserPayload>({
    mutationFn: (payload) => userService.updateUser(userId, payload),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
      toast.success('User updated', {
        description: `Changes to "${updatedUser.name}" have been saved.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update user', {
        description: parsed.message,
      })
    },
  })
}

export function useResetPassword() {
  return useMutation<ResetPasswordResponse, Error, string>({
    mutationFn: (userId) => userService.resetPassword(userId),
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to reset password', {
        description: parsed.message,
      })
    },
  })
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient()

  return useMutation<ManagedUser, Error, { id: string; active: boolean; name: string }>({
    mutationFn: ({ id, active }) => userService.toggleStatus(id, active),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
      toast.success(variables.active ? 'Account reactivated' : 'Account deactivated', {
        description: `Status updated for "${variables.name}".`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update account status', {
        description: parsed.message,
      })
    },
  })
}

