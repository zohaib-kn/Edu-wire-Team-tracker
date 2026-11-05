import { Building2, Users } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useBranches, useTeams } from '@/features/tasks/hooks/useMetadata'
import type { ReportFilterParams } from '../types/report.types'

export interface ReportsFilterBarProps {
  filters: ReportFilterParams
  onFilterChange: (filters: ReportFilterParams) => void
}

export function ReportsFilterBar({
  filters,
  onFilterChange,
}: ReportsFilterBarProps) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'
  const isBranchAdmin = user?.role === 'Branch Admin'
  const isTeamLead = user?.role === 'Team Lead'

  const { data: branches = [] } = useBranches()
  const { data: allTeams = [] } = useTeams()

  // Branch scope resolution
  const userBranch = isBranchAdmin ? (user?.branchId || '') : filters.branch || 'all'

  // Filter teams limited to selected branch
  const availableTeams = allTeams.filter((t) => {
    if (isBranchAdmin && user?.branchId) {
      return !t.branchId || t.branchId === user.branchId
    }
    if (userBranch && userBranch !== 'all') {
      return !t.branchId || t.branchId === userBranch
    }
    return true
  })

  const handleBranchChange = (newBranch: string) => {
    // If branch changes, reset team if incompatible
    const nextTeam =
      filters.team && filters.team !== 'all'
        ? availableTeams.some((t) => (t.id === filters.team || t.name === filters.team) && (!t.branchId || t.branchId === newBranch))
          ? filters.team
          : 'all'
        : 'all'

    onFilterChange({
      branch: newBranch === 'all' ? undefined : newBranch,
      team: nextTeam === 'all' ? undefined : nextTeam,
    })
  }

  const handleTeamChange = (newTeam: string) => {
    onFilterChange({
      ...filters,
      team: newTeam === 'all' ? undefined : newTeam,
    })
  }

  // If Team Lead, their scope is strictly fixed to their own team; hide redundant selectors or show fixed pill
  if (isTeamLead) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
        <Users className="w-4 h-4 text-[#1D4ED8]" />
        <span>
          Reporting scope limited to your assigned team: <strong>{user?.teamId || 'Your Team Desk'}</strong>
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      {/* Branch Filter (for Super Admin with multiple branches) */}
      {isSuperAdmin && (
        <div className="w-48 sm:w-56">
          <Select
            id="report-branch"
            value={filters.branch || 'all'}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="all">All Branches (Organization)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.name || b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Branch fixed label for Branch Admin */}
      {isBranchAdmin && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Branch: <strong>{user?.branchId || 'Assigned Branch'}</strong></span>
        </div>
      )}

      {/* Team Filter */}
      <div className="w-44 sm:w-52">
        <Select
          id="report-team"
          value={filters.team || 'all'}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="h-9 text-xs"
        >
          <option value="all">All Teams</option>
          {availableTeams.map((t) => (
            <option key={t.id} value={t.name || t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
