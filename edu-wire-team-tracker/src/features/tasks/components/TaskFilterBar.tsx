import { Building2, Users } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { BranchOption, TeamOption } from '../types/task.types'

export interface TaskFilterBarProps {
  selectedBranch: string
  onBranchChange: (branch: string) => void
  selectedTeam: string
  onTeamChange: (team: string) => void
  branches: BranchOption[]
  teams: TeamOption[]
  showBranchFilter?: boolean
}

export function TaskFilterBar({
  selectedBranch,
  onBranchChange,
  selectedTeam,
  onTeamChange,
  branches,
  teams,
  showBranchFilter = false,
}: TaskFilterBarProps) {
  // Filter teams by selected branch if branch is selected
  const visibleTeams = selectedBranch && selectedBranch !== 'all'
    ? teams.filter((t) => !t.branchId || t.branchId === selectedBranch)
    : teams

  return (
    <div className="flex flex-col gap-3 py-2">
      {/* Branch Chips (if authorized for multiple branches) */}
      {showBranchFilter && branches.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0 mr-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Branch:</span>
          </div>

          <button
            type="button"
            onClick={() => onBranchChange('all')}
            className={cn(
              'px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0 border',
              selectedBranch === 'all' || !selectedBranch
                ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs'
                : 'bg-white text-slate-600 border-[#E2E8F0] hover:bg-slate-50',
            )}
          >
            All Branches
          </button>

          {branches.map((b) => {
            const isSelected = selectedBranch === b.id || selectedBranch === b.name
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onBranchChange(b.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0 border',
                  isSelected
                    ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs'
                    : 'bg-white text-slate-600 border-[#E2E8F0] hover:bg-slate-50',
                )}
              >
                {b.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Team Chips */}
      {visibleTeams.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0 mr-1">
            <Users className="w-3.5 h-3.5" />
            <span>Team:</span>
          </div>

          <button
            type="button"
            onClick={() => onTeamChange('all')}
            className={cn(
              'px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0 border',
              selectedTeam === 'all' || !selectedTeam
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-[#E2E8F0] hover:bg-slate-50',
            )}
          >
            All Teams
          </button>

          {visibleTeams.map((t) => {
            const isSelected = selectedTeam === t.id || selectedTeam === t.name
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTeamChange(t.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0 border',
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-[#E2E8F0] hover:bg-slate-50',
                )}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

