import { apiClient } from '@/lib/api/apiClient'
import type { BranchOption, TeamMemberOption, TeamOption } from '../types/task.types'

export const metadataService = {
  /**
   * Fetches authorized teams from GET /api/v1/teams
   */
  async getTeams(): Promise<TeamOption[]> {
    try {
      const response = await apiClient.get<TeamOption[] | { teams: TeamOption[] } | { data: TeamOption[] }>('/teams')
      const raw = response.data
      if (Array.isArray(raw)) return raw
      if (raw && typeof raw === 'object') {
        if ('teams' in raw && Array.isArray(raw.teams)) return raw.teams
        if ('data' in raw && Array.isArray(raw.data)) return raw.data
      }
      return []
    } catch {
      // If backend teams endpoint is not yet mounted, return empty array gracefully
      return []
    }
  },

  /**
   * Fetches authorized branches from GET /api/v1/branches
   */
  async getBranches(): Promise<BranchOption[]> {
    try {
      const response = await apiClient.get<BranchOption[] | { branches: BranchOption[] } | { data: BranchOption[] }>('/branches')
      const raw = response.data
      if (Array.isArray(raw)) return raw
      if (raw && typeof raw === 'object') {
        if ('branches' in raw && Array.isArray(raw.branches)) return raw.branches
        if ('data' in raw && Array.isArray(raw.data)) return raw.data
      }
      return []
    } catch {
      return []
    }
  },

  /**
   * Fetches eligible team members for owner assignment from GET /api/v1/teams/:teamId/members or GET /api/v1/users
   */
  async getTeamMembers(teamId: string): Promise<TeamMemberOption[]> {
    if (!teamId) return []
    try {
      const response = await apiClient.get<
        TeamMemberOption[] | { members: TeamMemberOption[] } | { users: TeamMemberOption[] } | { data: TeamMemberOption[] }
      >(`/teams/${encodeURIComponent(teamId)}/members`)

      const raw = response.data
      if (Array.isArray(raw)) return raw
      if (raw && typeof raw === 'object') {
        if ('members' in raw && Array.isArray(raw.members)) return raw.members
        if ('users' in raw && Array.isArray(raw.users)) return raw.users
        if ('data' in raw && Array.isArray(raw.data)) return raw.data
      }
      return []
    } catch {
      // Fallback: try GET /api/v1/users?team=...
      try {
        const response = await apiClient.get<
          TeamMemberOption[] | { users: TeamMemberOption[] } | { data: TeamMemberOption[] }
        >('/users', { params: { team: teamId } })
        const raw = response.data
        if (Array.isArray(raw)) return raw
        if (raw && typeof raw === 'object') {
          if ('users' in raw && Array.isArray(raw.users)) return raw.users
          if ('data' in raw && Array.isArray(raw.data)) return raw.data
        }
        return []
      } catch {
        return []
      }
    }
  },

  /**
   * Fetches eligible supervisors (Team Leads, Branch Admins, Super Admins) in a branch for Reporting Manager selection
   */
  async getBranchSupervisors(branchId?: string): Promise<TeamMemberOption[]> {
    try {
      const params: Record<string, string> = { limit: '100' }
      if (branchId && branchId !== 'all') params.branch = branchId
      const response = await apiClient.get<any>('/users', { params })
      const raw = response.data
      const list = Array.isArray(raw) ? raw : (raw?.data || raw?.users || [])
      return list
        .filter((u: any) => u.isActive && ['Team Lead', 'Branch Admin', 'Super Admin'].includes(u.role))
        .map((u: any) => ({
          id: u.id || u._id,
          name: u.name,
          email: u.email,
          role: u.role,
        }))
    } catch {
      return []
    }
  },
}

