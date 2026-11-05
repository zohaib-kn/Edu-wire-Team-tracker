import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { organizationService } from '../services/organizationService'
import { taskKeys } from '@/features/tasks/hooks/queryKeys'
import { extractApiError } from '@/lib/api/errorHandler'
import type {
  BranchItem,
  CreateBranchPayload,
  CreateTeamPayload,
  TeamItem,
  UpdateBranchPayload,
  UpdateTeamPayload,
} from '../types/organization.types'

export const orgKeys = {
  all: ['organization'] as const,
  branches: () => [...orgKeys.all, 'branches'] as const,
  teams: (branch?: string) => [...orgKeys.all, 'teams', branch || 'all'] as const,
}

// Queries
export function useBranchesList() {
  return useQuery<BranchItem[]>({
    queryKey: orgKeys.branches(),
    queryFn: () => organizationService.getBranches(),
  })
}

export function useTeamsList(branch?: string) {
  return useQuery<TeamItem[]>({
    queryKey: orgKeys.teams(branch),
    queryFn: () => organizationService.getTeams(branch),
  })
}

// Mutations
export function useCreateBranch() {
  const queryClient = useQueryClient()

  return useMutation<BranchItem, Error, CreateBranchPayload>({
    mutationFn: (payload) => organizationService.createBranch(payload),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.metadata.branches() })
      toast.success('Branch created', {
        description: `Branch "${branch.name}" has been created.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to create branch', {
        description: parsed.message,
      })
    },
  })
}

export function useUpdateBranch(id: string) {
  const queryClient = useQueryClient()

  return useMutation<BranchItem, Error, UpdateBranchPayload>({
    mutationFn: (payload) => organizationService.updateBranch(id, payload),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.metadata.branches() })
      toast.success('Branch updated', {
        description: `Changes to "${branch.name}" have been saved.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update branch', {
        description: parsed.message,
      })
    },
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()

  return useMutation<TeamItem, Error, CreateTeamPayload>({
    mutationFn: (payload) => organizationService.createTeam(payload),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.metadata.teams() })
      toast.success('Team created', {
        description: `Team "${team.name}" has been created.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to create team', {
        description: parsed.message,
      })
    },
  })
}

export function useUpdateTeam(id: string) {
  const queryClient = useQueryClient()

  return useMutation<TeamItem, Error, UpdateTeamPayload>({
    mutationFn: (payload) => organizationService.updateTeam(id, payload),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: orgKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.metadata.teams() })
      toast.success('Team updated', {
        description: `Changes to "${team.name}" have been saved.`,
      })
    },
    onError: (error) => {
      const parsed = extractApiError(error)
      toast.error('Failed to update team', {
        description: parsed.message,
      })
    },
  })
}

