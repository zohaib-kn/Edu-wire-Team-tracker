import { useState, useMemo } from 'react'
import { Plus, Building2, Users, RefreshCw } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/lib/permissions/permissions'
import { useBranchesList, useTeamsList } from '@/features/organization/hooks/useOrganization'
import { BranchesTable } from '@/features/organization/components/BranchesTable'
import { BranchFormSheet } from '@/features/organization/components/BranchFormSheet'
import { TeamsTable } from '@/features/organization/components/TeamsTable'
import { TeamFormSheet } from '@/features/organization/components/TeamFormSheet'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { usePageHeader } from '@/context/HeaderContext'
import { cn } from '@/lib/utils/cn'
import type { BranchItem, TeamItem } from '@/features/organization/types/organization.types'

export function BranchesTeamsPage() {
  const { user } = useAuth()
  const { can } = usePermission()

  const canManageBranches = can(PERMISSIONS.BRANCH_MANAGE)
  const canManageTeams = can(PERMISSIONS.TEAM_MANAGE)

  // Default to teams tab if user cannot manage branches (e.g. Branch Admin)
  const [activeTab, setActiveTab] = useState<'branches' | 'teams'>(
    canManageBranches ? 'branches' : 'teams',
  )

  // Queries
  const {
    data: branchesData = [],
    isLoading: isBranchesLoading,
    isError: isBranchesError,
    refetch: refetchBranches,
  } = useBranchesList()

  // For Branch Admin, pass their branch
  const branchFilter = user?.role === 'Branch Admin' ? user.branchId || undefined : undefined

  const {
    data: teamsData = [],
    isLoading: isTeamsLoading,
    isError: isTeamsError,
    refetch: refetchTeams,
  } = useTeamsList(branchFilter)

  // Sheet states
  const [isBranchSheetOpen, setIsBranchSheetOpen] = useState(false)
  const [branchToEdit, setBranchToEdit] = useState<BranchItem | null>(null)

  const [isTeamSheetOpen, setIsTeamSheetOpen] = useState(false)
  const [teamToEdit, setTeamToEdit] = useState<TeamItem | null>(null)

  const branches = useMemo(() => branchesData || [], [branchesData])
  const teams = useMemo(() => teamsData || [], [teamsData])

  // Top Header synchronization
  usePageHeader({
    title: 'Branches & Teams',
    subtitle: 'Configure physical branch centers and functional operational teams',
    actions: (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchBranches()
            refetchTeams()
          }}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          aria-label="Refresh organizational structure"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {activeTab === 'branches' && canManageBranches && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setBranchToEdit(null)
              setIsBranchSheetOpen(true)
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Add Branch</span>
          </Button>
        )}

        {activeTab === 'teams' && canManageTeams && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTeamToEdit(null)
              setIsTeamSheetOpen(true)
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Create Team</span>
          </Button>
        )}
      </div>
    ),
  })

  return (
    <div className="space-y-6">
      {/* Pill-Style Tabs Switcher */}
      <div className="flex items-center gap-2">
        {canManageBranches && (
          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border',
              activeTab === 'branches'
                ? 'bg-pill-dark text-white border-pill-dark shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>Branches ({branches.length})</span>
          </button>
        )}

        {canManageTeams && (
          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer select-none border',
              activeTab === 'teams'
                ? 'bg-pill-dark text-white border-pill-dark shadow-xs'
                : 'bg-surface text-text-muted border-border-subtle hover:bg-slate-50 hover:text-text-primary',
            )}
          >
            <Users className="w-4 h-4" />
            <span>Teams ({teams.length})</span>
          </button>
        )}
      </div>

      {/* Tab 1: Branches */}
      {activeTab === 'branches' && canManageBranches && (
        <section aria-label="Branch Locations">
          {isBranchesLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-text-muted">
              <Spinner size="lg" className="text-brand-blue mb-3" />
              <p className="text-sm font-medium">Loading branch records...</p>
            </div>
          ) : isBranchesError ? (
            <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 text-center text-sm text-tint-red-text">
              <p className="font-semibold mb-1">Failed to load branches</p>
              <p className="text-xs text-destructive mb-4">
                The branch service is currently unreachable.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchBranches()}>
                Retry
              </Button>
            </div>
          ) : (
            <BranchesTable
              branches={branches}
              onEdit={(b) => {
                setBranchToEdit(b)
                setIsBranchSheetOpen(true)
              }}
              canManage={canManageBranches}
            />
          )}
        </section>
      )}

      {/* Tab 2: Teams */}
      {activeTab === 'teams' && canManageTeams && (
        <section aria-label="Functional Teams">
          {isTeamsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-text-muted">
              <Spinner size="lg" className="text-brand-blue mb-3" />
              <p className="text-sm font-medium">Loading team records...</p>
            </div>
          ) : isTeamsError ? (
            <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 text-center text-sm text-tint-red-text">
              <p className="font-semibold mb-1">Failed to load teams</p>
              <p className="text-xs text-destructive mb-4">
                The team service is currently unreachable.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchTeams()}>
                Retry
              </Button>
            </div>
          ) : (
            <TeamsTable
              teams={teams}
              onEdit={(t) => {
                setTeamToEdit(t)
                setIsTeamSheetOpen(true)
              }}
              canManage={canManageTeams}
            />
          )}
        </section>
      )}

      {/* Branch Form Sheet */}
      <BranchFormSheet
        isOpen={isBranchSheetOpen}
        onClose={() => setIsBranchSheetOpen(false)}
        branchToEdit={branchToEdit}
      />

      {/* Team Form Sheet */}
      <TeamFormSheet
        isOpen={isTeamSheetOpen}
        onClose={() => setIsTeamSheetOpen(false)}
        teamToEdit={teamToEdit}
      />
    </div>
  )
}
