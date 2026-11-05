import { apiClient } from '@/lib/api/apiClient'
import type {
  BranchItem,
  CreateBranchPayload,
  CreateTeamPayload,
  TeamItem,
  UpdateBranchPayload,
  UpdateTeamPayload,
} from '../types/organization.types'

export const organizationService = {
  /**
   * Fetches branches from GET /api/v1/branches
   */
  async getBranches(): Promise<BranchItem[]> {
    const response = await apiClient.get<
      BranchItem[] | { branches: BranchItem[] } | { data: BranchItem[] }
    >('/branches')

    const raw = response.data
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') {
      if ('branches' in raw && Array.isArray(raw.branches)) return raw.branches
      if ('data' in raw && Array.isArray(raw.data)) return raw.data
    }
    return []
  },

  /**
   * Creates a branch via POST /api/v1/branches
   */
  async createBranch(payload: CreateBranchPayload): Promise<BranchItem> {
    const response = await apiClient.post<
      BranchItem | { data: BranchItem } | { branch: BranchItem }
    >('/branches', payload)
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.branch || raw) as BranchItem
  },

  /**
   * Updates a branch via PATCH /api/v1/branches/:id
   */
  async updateBranch(id: string, payload: UpdateBranchPayload): Promise<BranchItem> {
    const response = await apiClient.patch<
      BranchItem | { data: BranchItem } | { branch: BranchItem }
    >(`/branches/${encodeURIComponent(id)}`, payload)
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.branch || raw) as BranchItem
  },

  /**
   * Fetches teams from GET /api/v1/teams
   */
  async getTeams(branch?: string): Promise<TeamItem[]> {
    const params: Record<string, string> = {}
    if (branch && branch !== 'all') params.branch = branch

    const response = await apiClient.get<
      TeamItem[] | { teams: TeamItem[] } | { data: TeamItem[] }
    >('/teams', { params })

    const raw = response.data
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') {
      if ('teams' in raw && Array.isArray(raw.teams)) return raw.teams
      if ('data' in raw && Array.isArray(raw.data)) return raw.data
    }
    return []
  },

  /**
   * Creates a team via POST /api/v1/teams
   */
  async createTeam(payload: CreateTeamPayload): Promise<TeamItem> {
    const response = await apiClient.post<
      TeamItem | { data: TeamItem } | { team: TeamItem }
    >('/teams', payload)
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.team || raw) as TeamItem
  },

  /**
   * Updates a team via PATCH /api/v1/teams/:id
   */
  async updateTeam(id: string, payload: UpdateTeamPayload): Promise<TeamItem> {
    const response = await apiClient.patch<
      TeamItem | { data: TeamItem } | { team: TeamItem }
    >(`/teams/${encodeURIComponent(id)}`, payload)
    const raw = response.data as Record<string, unknown>
    return (raw?.data || raw?.team || raw) as TeamItem
  },
}

