import { useId, useMemo, useState, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Clock3,
  Folder,
  LayoutGrid,
  List,
  Lock,
  Search,
  ShieldCheck,
  User,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import folderIconImg from '@/assets/folder-icon.png'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'
import { extractApiError } from '@/lib/api/errorHandler'
import { useTask } from '../hooks/useTask'
import { formatDateOnly, isTaskOverdue } from '../utils/dateUtils'
import { getTaskDetailNavState } from '../utils/taskNavigation'
import { ActivityTimeline } from './ActivityTimeline'
import { TaskFolderItem } from './TaskFolderItem'
import type { SubtaskItem, Task, TaskStatus } from '../types/task.types'

type SidebarSection = 'tasks' | 'activity' | 'team'
type ViewMode = 'grid' | 'list'

interface ExplorerUiState {
  taskId: string
  section: SidebarSection
  viewMode: ViewMode
  searchQuery: string
  selectedSubtaskId: string | null
}

const DEFAULT_STATE: Omit<ExplorerUiState, 'taskId'> = {
  section: 'tasks',
  viewMode: 'grid',
  searchQuery: '',
  selectedSubtaskId: null,
}

const STATUS_BADGE_CONFIG: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  todo: {
    label: 'To Do',
    className: 'bg-slate-100 text-slate-700 border border-slate-200/80',
  },
  doing: {
    label: 'In Progress',
    className: 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border/80',
  },
  done: {
    label: 'Done',
    className: 'bg-tint-green-bg text-tint-green-text border border-tint-green-border/80',
  },
}

const SKELETON_INDICES = [0, 1, 2, 3] as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

interface TeamMemberSummary {
  key: string
  name: string
  roles: string[]
  taskCount: number
}

function summarizeSubtaskMembers(subtasks: SubtaskItem[]): TeamMemberSummary[] {
  const map = new Map<string, TeamMemberSummary>()
  for (const sub of subtasks) {
    const ownerName = (sub.owner || '').trim()
    if (!ownerName) continue
    const key = sub.ownerId || ownerName.toLowerCase()
    const existing = map.get(key)
    const role = (sub.responsibilityLabel || '').trim()
    if (existing) {
      existing.taskCount += 1
      if (role && !existing.roles.includes(role)) {
        existing.roles.push(role)
      }
    } else {
      map.set(key, {
        key,
        name: ownerName,
        roles: role ? [role] : [],
        taskCount: 1,
      })
    }
  }
  return Array.from(map.values())
}

export interface TaskFolderExplorerProps {
  isOpen: boolean
  onClose: () => void
  projectTask: Task | null
  triggerRef?: RefObject<HTMLElement | null>
}

export function TaskFolderExplorer({
  isOpen,
  onClose,
  projectTask,
  triggerRef,
}: TaskFolderExplorerProps) {
  const headingId = useId()
  const navigate = useNavigate()
  const location = useLocation()

  const currentTaskId = projectTask?.id || ''

  const [uiState, setUiState] = useState<ExplorerUiState>({
    taskId: '',
    ...DEFAULT_STATE,
  })

  const scopedState: Omit<ExplorerUiState, 'taskId'> =
    uiState.taskId === currentTaskId ? uiState : DEFAULT_STATE

  const updateState = (
    updater:
      | Partial<Omit<ExplorerUiState, 'taskId'>>
      | ((prev: Omit<ExplorerUiState, 'taskId'>) => Partial<Omit<ExplorerUiState, 'taskId'>>),
  ) => {
    setUiState((prev) => {
      const base = prev.taskId === currentTaskId ? prev : { taskId: currentTaskId, ...DEFAULT_STATE }
      const patch = typeof updater === 'function' ? updater(base) : updater
      return {
        ...base,
        ...patch,
        taskId: currentTaskId,
      }
    })
  }

  const handleClose = () => {
    setUiState({ taskId: '', ...DEFAULT_STATE })
    onClose()
  }

  // Fetch authorized single parent task + subtasks + activity on open (cached via TanStack Query)
  const requestedTaskId = isOpen && currentTaskId ? currentTaskId : ''
  const {
    data: liveTask,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useTask(requestedTaskId)

  const parsedError = useMemo(() => (isError ? extractApiError(error) : null), [isError, error])
  const errorStatus = parsedError?.status
  const isForbidden = errorStatus === 403
  const isNotFound = errorStatus === 404
  const hideSensitiveContext = isError && (isForbidden || isNotFound)

  const activeTask = isError ? null : (liveTask ?? projectTask)
  const activeSubtasks = activeTask?.subtasks

  const subtasks = useMemo(() => activeSubtasks ?? [], [activeSubtasks])

  const teamMembers = useMemo(() => summarizeSubtaskMembers(subtasks), [subtasks])

  const hasTeamData = Boolean(
    activeTask &&
      (activeTask.reportingManager ||
        activeTask.createdBy ||
        teamMembers.length > 0),
  )

  const filteredSubtasks = useMemo(() => {
    const query = scopedState.searchQuery.trim().toLowerCase()
    if (!query) return subtasks
    return subtasks.filter((sub) => {
      const titleMatch = sub.title.toLowerCase().includes(query)
      const ownerMatch = (sub.owner || '').toLowerCase().includes(query)
      const roleMatch = (sub.responsibilityLabel || '').toLowerCase().includes(query)
      return titleMatch || ownerMatch || roleMatch
    })
  }, [subtasks, scopedState.searchQuery])

  const totalExpected = activeTask?.progress?.totalSubtasks ?? subtasks.length
  const hasPartialSubset = Boolean(!isError && totalExpected > subtasks.length && !isFetching)
  const isInitialSubtaskLoading = Boolean(!isError && isLoading && !liveTask && !projectTask?.subtasks)

  if (!projectTask) {
    return null
  }

  const headerTitle = hideSensitiveContext
    ? isForbidden
      ? 'Restricted Folder'
      : 'Folder Not Found'
    : (activeTask?.title || 'Folder')

  const contextLabel = !hideSensitiveContext && activeTask
    ? [activeTask.team, activeTask.branch && activeTask.branch !== activeTask.team ? activeTask.branch : null]
        .filter(Boolean)
        .join(' · ')
    : ''

  const handleOpenSubtask = (subtaskId: string) => {
    setUiState({ taskId: '', ...DEFAULT_STATE })
    onClose()
    navigate(`/tasks/${encodeURIComponent(subtaskId)}`, {
      state: getTaskDetailNavState(location),
    })
  }

  const sidebarDisabled = Boolean(isError)
  const effectiveSection: SidebarSection = sidebarDisabled ? 'tasks' : scopedState.section
  const teamDisabled = sidebarDisabled || (!isLoading && !hasTeamData)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      triggerRef={triggerRef}
      ariaLabelledBy={headingId}
      unwrapped
      backdropClassName="bg-slate-900/35 backdrop-blur-[2px]"
      containerClassName="p-3 sm:p-6"
      panelClassName="w-full max-w-[760px] h-[calc(100dvh-24px)] sm:h-[468px] max-h-[90dvh] rounded-[18px] bg-surface border border-border-subtle shadow-[0_18px_50px_rgba(15,23,42,0.14)] overflow-hidden flex flex-col font-sans"
    >
      {/* macOS Finder-inspired window top bar */}
      <div className="h-[45px] shrink-0 bg-[#F3F4F6] border-b border-border-subtle px-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-[9px]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close folder explorer"
            title="Close"
            className="relative w-3.5 h-3.5 rounded-full bg-[#FF5F57] hover:brightness-95 transition-all cursor-pointer before:content-[''] before:absolute before:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-1"
          />
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 rounded-full bg-[#FEBC2E] inline-block"
          />
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 rounded-full bg-[#28C840] inline-block"
          />
        </div>
      </div>

      {/* Explorer body: sidebar + main workspace */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row bg-surface">
        {/* Internal sidebar */}
        <aside
          aria-label="Folder explorer sections"
          className="shrink-0 sm:w-[146px] border-b sm:border-b-0 sm:border-r border-border-subtle px-3 py-2 sm:px-2.5 sm:py-3.5 flex flex-row sm:flex-col gap-1 overflow-x-auto bg-surface"
        >
          <button
            type="button"
            disabled={sidebarDisabled}
            aria-disabled={sidebarDisabled || undefined}
            aria-current={effectiveSection === 'tasks' ? 'page' : undefined}
            onClick={() => updateState({ section: 'tasks' })}
            className={cn(
              'inline-flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium shrink-0 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
              sidebarDisabled
                ? 'text-text-muted/50 cursor-not-allowed'
                : effectiveSection === 'tasks'
                  ? 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border/80 cursor-default'
                  : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary border border-transparent cursor-pointer',
            )}
          >
            <Folder className="w-4 h-4 shrink-0" />
            <span>Tasks</span>
          </button>

          <button
            type="button"
            disabled={sidebarDisabled}
            aria-disabled={sidebarDisabled || undefined}
            aria-current={effectiveSection === 'activity' ? 'page' : undefined}
            onClick={() => updateState({ section: 'activity' })}
            className={cn(
              'inline-flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium shrink-0 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
              sidebarDisabled
                ? 'text-text-muted/50 cursor-not-allowed'
                : effectiveSection === 'activity'
                  ? 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border/80 cursor-default'
                  : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary border border-transparent cursor-pointer',
            )}
          >
            <Clock3 className="w-4 h-4 shrink-0" />
            <span>Activity</span>
          </button>

          <button
            type="button"
            disabled={teamDisabled}
            aria-disabled={teamDisabled || undefined}
            aria-current={effectiveSection === 'team' ? 'page' : undefined}
            onClick={() => updateState({ section: 'team' })}
            className={cn(
              'inline-flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium shrink-0 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
              teamDisabled
                ? 'text-text-muted/50 cursor-not-allowed'
                : effectiveSection === 'team'
                  ? 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border/80 cursor-default'
                  : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary border border-transparent cursor-pointer',
            )}
          >
            <UsersRound className="w-4 h-4 shrink-0" />
            <span>Team</span>
          </button>
        </aside>

        {/* Right content column */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface">
          {/* Content header */}
          <div className="shrink-0 px-5 pt-4 pb-2.5 flex items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-wrap sm:flex-nowrap items-center gap-x-2.5 gap-y-1.5">
              <div className="min-w-0 flex items-center gap-2 max-w-full">
                {isForbidden ? (
                  <Lock className="w-[17px] h-[17px] text-text-muted shrink-0" />
                ) : (
                  <Folder className="w-[18px] h-[18px] text-brand-blue shrink-0" />
                )}
                <h2
                  id={headingId}
                  className="min-w-0 text-[15px] font-semibold text-text-primary truncate"
                  title={headerTitle}
                >
                  {headerTitle}
                </h2>
              </div>
              {contextLabel && (
                <span
                  title={contextLabel}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-slate-50 px-2.5 py-0.5 text-[12px] font-medium text-text-secondary max-w-[220px] shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="truncate">{contextLabel}</span>
                </span>
              )}
            </div>

            {effectiveSection === 'tasks' && !isError && (
              <div
                role="group"
                aria-label="View layout"
                className="shrink-0 inline-flex items-center gap-1 rounded-[10px] border border-border-subtle bg-surface p-0.5"
              >
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={scopedState.viewMode === 'grid'}
                  onClick={() => updateState({ viewMode: 'grid' })}
                  className={cn(
                    'w-[32px] h-[32px] rounded-[8px] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer',
                    scopedState.viewMode === 'grid'
                      ? 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border/80'
                      : 'text-text-muted hover:text-text-primary hover:bg-slate-50 border border-transparent',
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={scopedState.viewMode === 'list'}
                  onClick={() => updateState({ viewMode: 'list' })}
                  className={cn(
                    'w-[32px] h-[32px] rounded-[8px] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer',
                    scopedState.viewMode === 'list'
                      ? 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border/80'
                      : 'text-text-muted hover:text-text-primary hover:bg-slate-50 border border-transparent',
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Search toolbar inside Tasks section when subtasks exist */}
          {effectiveSection === 'tasks' &&
            !isError &&
            !isInitialSubtaskLoading &&
            subtasks.length > 0 && (
              <div className="shrink-0 px-5 pb-3 flex items-center gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={scopedState.searchQuery}
                    onChange={(e) => updateState({ searchQuery: e.target.value })}
                    placeholder="Search subtasks..."
                    aria-label="Search subtasks by title, role, or assignee"
                    className="w-full h-8 pl-8 pr-7 rounded-[8px] border border-border-subtle bg-slate-50/70 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:bg-surface focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 transition-colors"
                  />
                  {scopedState.searchQuery && (
                    <button
                      type="button"
                      onClick={() => updateState({ searchQuery: '' })}
                      aria-label="Clear subtask search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <span
                  aria-live="polite"
                  className="shrink-0 text-[11px] font-medium text-text-muted tabular-nums"
                >
                  {scopedState.searchQuery.trim()
                    ? `${filteredSubtasks.length} of ${subtasks.length}`
                    : `${subtasks.length} ${subtasks.length === 1 ? 'task' : 'tasks'}`}
                </span>
              </div>
            )}

          {/* Main scrollable content pane */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">
            {isError ? (
              <div
                role="alert"
                className="h-full min-h-[220px] flex items-center justify-center"
              >
                <div className="max-w-sm w-full rounded-[12px] border border-border-subtle bg-slate-50/70 p-6 text-center space-y-3">
                  <div className="mx-auto w-9 h-9 rounded-full bg-tint-red-bg text-destructive flex items-center justify-center">
                    {isForbidden ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-text-primary">
                      {isForbidden
                        ? 'Access Denied'
                        : isNotFound
                          ? 'Folder Not Found'
                          : 'Unable to Load Folder'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {isForbidden
                        ? 'You do not have permission to view this folder.'
                        : isNotFound
                          ? 'This parent task could not be found or has been deleted.'
                          : parsedError?.message ||
                            'The server is unavailable right now. Please try again.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {!isForbidden && !isNotFound && (
                      <Button variant="outline" size="sm" onClick={() => refetch()}>
                        Retry
                      </Button>
                    )}
                    <Button variant="primary" size="sm" onClick={handleClose}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            ) : effectiveSection === 'tasks' ? (
              isInitialSubtaskLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 justify-items-center content-start"
                >
                  <span className="sr-only">Loading subtasks...</span>
                  {SKELETON_INDICES.map((index) => (
                    <div
                      key={index}
                      aria-hidden="true"
                      className="w-full max-w-[145px] h-[148px] rounded-[12px] border border-border-subtle bg-surface px-3 py-4 flex flex-col items-center justify-center gap-3 animate-pulse"
                    >
                      <div className="w-16 h-16 rounded-[10px] bg-slate-100" />
                      <div className="w-20 h-2.5 rounded-full bg-slate-200/80" />
                    </div>
                  ))}
                </div>
              ) : subtasks.length === 0 ? (
                <div className="h-full min-h-[220px] flex items-center justify-center">
                  <div className="max-w-xs w-full rounded-[12px] border border-dashed border-border-subtle bg-slate-50/50 p-6 text-center space-y-2">
                    <div className="mx-auto w-9 h-9 rounded-full bg-tint-blue-bg text-brand-blue flex items-center justify-center">
                      <Folder className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-medium text-text-primary">
                      No subtasks in this folder
                    </p>
                    <p className="text-xs text-text-muted">
                      Subtasks assigned under this parent task will appear here.
                    </p>
                  </div>
                </div>
              ) : filteredSubtasks.length === 0 ? (
                <div className="h-full min-h-[200px] flex items-center justify-center">
                  <div className="max-w-xs w-full rounded-[12px] border border-dashed border-border-subtle bg-slate-50/50 p-5 text-center space-y-2.5">
                    <p className="text-sm font-medium text-text-primary">
                      No matching subtasks
                    </p>
                    <p className="text-xs text-text-muted break-words">
                      No subtasks match &ldquo;{scopedState.searchQuery.trim()}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => updateState({ searchQuery: '' })}
                      className="inline-flex items-center px-3 py-1.5 rounded-[8px] text-xs font-medium text-brand-blue bg-tint-blue-bg hover:bg-tint-blue-border/50 transition-colors cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {hasPartialSubset && (
                    <div className="rounded-[8px] border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[11px] text-amber-800 flex items-center justify-between gap-2">
                      <span>
                        Showing {subtasks.length} of {totalExpected} subtasks loaded.
                      </span>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="font-semibold underline hover:text-amber-950 cursor-pointer"
                      >
                        Refresh
                      </button>
                    </div>
                  )}

                  {scopedState.viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 justify-items-center content-start">
                      {filteredSubtasks.map((sub) => (
                        <TaskFolderItem
                          key={sub.id}
                          subtask={sub}
                          isSelected={scopedState.selectedSubtaskId === sub.id}
                          onSelect={(id) => updateState({ selectedSubtaskId: id })}
                          onOpen={handleOpenSubtask}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul
                      aria-label="Subtasks list"
                      className="rounded-[12px] border border-border-subtle divide-y divide-border-subtle bg-surface overflow-hidden"
                    >
                      {filteredSubtasks.map((sub) => {
                        const isSelected = scopedState.selectedSubtaskId === sub.id
                        const statusCfg = STATUS_BADGE_CONFIG[sub.status] || STATUS_BADGE_CONFIG.todo
                        const overdue = isTaskOverdue(sub.due, sub.status, sub.deadlineAt)
                        const dueLabel = sub.due ? formatDateOnly(sub.due) : null

                        return (
                          <li
                            key={sub.id}
                            className="[content-visibility:auto] [contain-intrinsic-size:auto_52px]"
                          >
                            <button
                              type="button"
                              title={sub.title}
                              aria-current={isSelected ? 'true' : undefined}
                              onClick={() => handleOpenSubtask(sub.id)}
                              onMouseEnter={() => updateState({ selectedSubtaskId: sub.id })}
                              onFocus={() => updateState({ selectedSubtaskId: sub.id })}
                              className={cn(
                                'w-full px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue',
                                isSelected
                                  ? 'bg-tint-blue-bg/70'
                                  : 'bg-surface hover:bg-slate-50/80',
                              )}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                <img
                                  src={folderIconImg}
                                  alt=""
                                  draggable={false}
                                  className="w-6 h-6 object-contain shrink-0 select-none pointer-events-none"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-medium text-text-primary truncate">
                                    {sub.title}
                                  </p>
                                  {sub.responsibilityLabel && (
                                    <p className="text-[11px] text-text-muted truncate">
                                      {sub.responsibilityLabel}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-2.5 pl-8 sm:pl-0 shrink-0 text-[11px]">
                                {sub.owner && (
                                  <span
                                    title={sub.owner}
                                    className="inline-flex items-center gap-1 text-text-secondary max-w-[115px]"
                                  >
                                    <User className="w-3 h-3 text-text-muted shrink-0" />
                                    <span className="truncate">{sub.owner}</span>
                                  </span>
                                )}

                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full px-2 py-0.5 font-medium whitespace-nowrap',
                                    statusCfg.className,
                                  )}
                                >
                                  {statusCfg.label}
                                </span>

                                {dueLabel && (
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 whitespace-nowrap',
                                      overdue ? 'text-destructive font-medium' : 'text-text-muted',
                                    )}
                                  >
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    <span>{dueLabel}</span>
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-0.5 font-medium text-brand-blue whitespace-nowrap">
                                  <span>Open</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            ) : effectiveSection === 'activity' ? (
              isFetching && !liveTask?.activity ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-text-muted"
                >
                  <Spinner size="md" className="text-brand-blue" />
                  <p className="text-xs">Loading activity timeline...</p>
                </div>
              ) : (
                <ActivityTimeline activities={liveTask?.activity ?? activeTask?.activity ?? []} />
              )
            ) : (
              <div className="space-y-4">
                {(activeTask?.reportingManager || activeTask?.createdBy) && (
                  <section aria-label="Task supervision" className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Supervision
                    </h3>
                    <div className="rounded-[12px] border border-border-subtle divide-y divide-border-subtle bg-surface">
                      {activeTask.reportingManager && (
                        <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="w-7 h-7 rounded-full bg-tint-blue-bg text-brand-blue text-[11px] font-semibold flex items-center justify-center shrink-0"
                            >
                              {getInitials(activeTask.reportingManager)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-text-primary truncate">
                                {activeTask.reportingManager}
                              </p>
                              <p className="text-[11px] text-text-muted">
                                Reporting Manager
                              </p>
                            </div>
                          </div>
                          <ShieldCheck className="w-4 h-4 text-brand-blue shrink-0" />
                        </div>
                      )}
                      {activeTask.createdBy && (
                        <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="w-7 h-7 rounded-full bg-slate-100 text-text-secondary text-[11px] font-semibold flex items-center justify-center shrink-0"
                            >
                              {getInitials(activeTask.createdBy)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-text-primary truncate">
                                {activeTask.createdBy}
                              </p>
                              <p className="text-[11px] text-text-muted">Created By</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section aria-label="Assigned members" className="space-y-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Assigned Members ({teamMembers.length})
                  </h3>
                  {teamMembers.length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-border-subtle bg-slate-50/50 p-5 text-center text-xs text-text-muted">
                      No subtask assignees available yet.
                    </div>
                  ) : (
                    <div className="rounded-[12px] border border-border-subtle divide-y divide-border-subtle bg-surface">
                      {teamMembers.map((member) => (
                        <div
                          key={member.key}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="w-7 h-7 rounded-full bg-tint-blue-bg text-brand-blue text-[11px] font-semibold flex items-center justify-center shrink-0"
                            >
                              {getInitials(member.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-text-primary truncate">
                                {member.name}
                              </p>
                              {member.roles.length > 0 && (
                                <p className="text-[11px] text-text-muted truncate">
                                  {member.roles.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-medium text-text-muted tabular-nums">
                            {member.taskCount} {member.taskCount === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
