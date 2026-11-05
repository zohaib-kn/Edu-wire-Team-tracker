import { useQuery } from '@tanstack/react-query'
import { userService } from '../services/userService'
import { userKeys } from './queryKeys'
import type { UserFilterParams, UsersListResponse } from '../types/userAdmin.types'

export function useUsers(filters?: UserFilterParams) {
  return useQuery<UsersListResponse>({
    queryKey: userKeys.list((filters || {}) as Record<string, unknown>),
    queryFn: () => userService.getUsers(filters),
  })
}

