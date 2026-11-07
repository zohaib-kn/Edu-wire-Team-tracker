import { useState, useMemo } from 'react'
import { Building2, ChevronDown, Check, Users, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { BranchOption, TeamOption } from '../types/task.types'

export interface FilterDropdownOption {
  id: string
  name: string
}

export interface FilterDropdownProps {
  label: string
  allLabel: string
  selectedId: string
  onSelect: (id: string) => void
  options: FilterDropdownOption[]
  icon: LucideIcon
  emptyMessage?: string
}

export function FilterDropdown({
  label,
  allLabel,
  selectedId,
  onSelect,
  options,
  icon: Icon,
  emptyMessage = 'No options available',
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentOption = useMemo(() => {
    return options.find((o) => o.id === selectedId || o.name === selectedId)
  }, [options, selectedId])

  const isActive = Boolean(selectedId && selectedId !== 'all')

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'h-9 px-3.5 rounded-input inline-flex items-center gap-2 text-xs transition-all cursor-pointer border shadow-card select-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20',
          isActive
            ? 'bg-pill-dark text-white border-pill-dark font-semibold'
            : 'bg-surface text-text-primary border-border-subtle hover:bg-slate-50 hover:border-slate-300 font-medium',
        )}
      >
        <Icon
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            isActive ? 'text-white/80' : 'text-text-muted',
          )}
        />
        <span>
          {isActive ? (
            <>
              <span className="text-white/70 font-normal mr-1">{label}:</span>
              <span>{currentOption?.name || selectedId}</span>
            </>
          ) : (
            allLabel
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 ml-0.5 transition-transform duration-200',
            isActive ? 'text-white/80' : 'text-text-muted',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="listbox"
            className="absolute left-0 mt-1.5 w-56 rounded-card bg-surface border border-border-subtle shadow-dropdown p-1.5 z-50 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto"
          >
            {/* If a specific item is active, offer a clear option */}
            {isActive && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSelect('all')
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-nav text-left text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors cursor-pointer text-[11px]"
                >
                  <span>Clear filter</span>
                  <X className="w-3 h-3" />
                </button>
                <div className="my-1 border-t border-border-subtle" />
              </>
            )}

            {/* Options list */}
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-muted">
                {emptyMessage}
              </div>
            ) : (
              options.map((opt) => {
                const isSelected =
                  selectedId === opt.id || selectedId === opt.name
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(isSelected ? 'all' : opt.id)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-2 rounded-nav text-left transition-colors cursor-pointer',
                      isSelected
                        ? 'font-semibold text-brand-blue bg-brand-blue-light'
                        : 'text-text-primary hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="truncate">{opt.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

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
  const visibleTeams = useMemo(() => {
    return selectedBranch && selectedBranch !== 'all'
      ? teams.filter((t) => !t.branchId || t.branchId === selectedBranch)
      : teams
  }, [teams, selectedBranch])

  const hasActiveFilter =
    Boolean(selectedBranch && selectedBranch !== 'all') ||
    Boolean(selectedTeam && selectedTeam !== 'all')

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
      {/* 1. Branch Dropdown */}
      {showBranchFilter && branches.length > 0 && (
        <FilterDropdown
          label="Branch"
          allLabel="All Branches"
          selectedId={selectedBranch}
          onSelect={onBranchChange}
          options={branches}
          icon={Building2}
        />
      )}

      {/* 2. Team Dropdown */}
      <FilterDropdown
        label="Team"
        allLabel="All Teams"
        selectedId={selectedTeam}
        onSelect={onTeamChange}
        options={visibleTeams}
        icon={Users}
        emptyMessage="No teams found for this branch"
      />

      {/* 3. Reset filters button if any filter is active */}
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            onBranchChange('all')
            onTeamChange('all')
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-nav text-xs font-medium text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors cursor-pointer"
          title="Reset all filters to All"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  )
}
