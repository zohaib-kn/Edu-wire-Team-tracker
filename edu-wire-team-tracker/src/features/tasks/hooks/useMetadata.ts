import { useQuery } from '@tanstack/react-query'
import { metadataService } from '../services/metadataService'
import { taskKeys } from './queryKeys'
import type { BranchOption, TeamMemberOption, TeamOption } from '../types/task.types'

export function useTeams() {
  return useQuery<TeamOption[]>({
    queryKey: taskKeys.metadata.teams(),
    queryFn: () => metadataService.getTeams(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useBranches() {
  return useQuery<BranchOption[]>({
    queryKey: taskKeys.metadata.branches(),
    queryFn: () => metadataService.getBranches(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTeamMembers(teamId: string) {
  return useQuery<TeamMemberOption[]>({
    queryKey: taskKeys.metadata.members(teamId),
    queryFn: () => metadataService.getTeamMembers(teamId),
    enabled: Boolean(teamId),
    staleTime: 2 * 60 * 1000,
  })
}

