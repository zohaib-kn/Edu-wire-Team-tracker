import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { roleService } from '../services/roleService'
import { extractApiError } from '@/lib/api/errorHandler'
import type { RoleItem, UpdateRolePayload } from '../types/role.types'

export const roleKeys = {
  all: ['roles'] as const,
  list: () => [...roleKeys.all, 'list'] as const,
}

export function useRolesList() {
  return useQuery<RoleItem[]>({
    queryKey: roleKeys.list(),
    queryFn: () => roleService.getRoles(),
  })
}

export function useUpdateRole(roleId: string) {
  const queryClient = useQueryClient()

  return useMutation<RoleItem, Error, UpdateRolePayload>({
    mutationFn: (payload) => roleService.updateRole(roleId, payload),
    onSuccess: (updatedRole) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.all })
      toast.success('Permissions updated', {
        description: `Permission matrix for "${updatedRole.name}" saved successfully.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update role permissions', {
        description: parsed.message,
      })
    },
  })
}

