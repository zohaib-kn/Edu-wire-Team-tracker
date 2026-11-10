import { useState, useEffect, useMemo } from 'react'
import { useForm, useWatch, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, User, Layers, Clock, Lock } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'
import {
  createTaskSchema,
  editTaskSchema,
  type CreateTaskFormValues,
} from '../schemas/taskSchemas'
import { useCreateTask } from '../hooks/useCreateTask'
import { useUpdateTask } from '../hooks/useUpdateTask'
import {
  useTeams,
  useBranches,
  useTeamMembers,
  useBranchSupervisors,
} from '../hooks/useMetadata'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  getTodayDateStringKolkata,
  formatTimeAMPM,
  formatUTCInTimezone,
} from '../utils/dateUtils'
import type { Task } from '../types/task.types'

export interface TaskFormSheetProps {
  isOpen: boolean
  onClose: () => void
  taskToEdit?: Task | null
}

const TIME_PRESETS = [
  { label: '10:00 AM', time: '10:00' },
  { label: '1:00 PM', time: '13:00' },
  { label: '5:00 PM', time: '17:00' },
  { label: '7:00 PM', time: '19:00' },
]

function TaskFormSheetInner({
  onClose,
  taskToEdit,
}: {
  onClose: () => void
  taskToEdit?: Task | null
}) {
  const { user } = useAuth()
  const isEditing = Boolean(taskToEdit)
  const isSuperAdmin = user?.role === 'Super Admin'

  const [mode, setMode] = useState<'single' | 'multiple'>('single')
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load branches and all teams
  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isError: isBranchesError,
  } = useBranches()
  const {
    data: allTeams = [],
    isLoading: isLoadingTeams,
    isError: isTeamsError,
  } = useTeams()

  // Initial branch resolution
  const initialBranch = useMemo(() => {
    if (taskToEdit?.branch) return taskToEdit.branch
    if (isSuperAdmin) {
      return branches[0]?.id || branches[0]?.name || ''
    }
    return user?.branchId || (user as any)?.branch || branches[0]?.id || ''
  }, [taskToEdit, isSuperAdmin, branches, user])

  // Deadline authorization: Members who are assignees cannot extend deadlines to avoid overdue state
  const canModifyDeadline = useMemo(() => {
    if (!isEditing || !taskToEdit) return true
    if (
      user?.role === 'Super Admin' ||
      user?.role === 'Branch Admin' ||
      user?.role === 'Team Lead'
    ) {
      return true
    }
    const isCreator = Boolean(
      taskToEdit.createdBy &&
        (taskToEdit.createdBy === user?.id || taskToEdit.createdBy === user?.name),
    )
    const isReportingManager = Boolean(
      taskToEdit.reportingManager &&
        (taskToEdit.reportingManager === user?.id ||
          taskToEdit.reportingManager === user?.name),
    )
    return isCreator || isReportingManager
  }, [isEditing, taskToEdit, user])

  // Resolve initial deadline info from taskToEdit
  const initialDeadline = useMemo(() => {
    if (!taskToEdit?.deadlineAt) return null
    return formatUTCInTimezone(
      taskToEdit.deadlineAt,
      taskToEdit.deadlineTimezone || 'Asia/Kolkata',
    )
  }, [taskToEdit])

  const defaultValues: CreateTaskFormValues = useMemo(() => {
    return {
      mode: 'single',
      title: taskToEdit?.title || '',
      note: taskToEdit?.note || '',
      branch: initialBranch,
      team: taskToEdit?.team || (allTeams[0]?.id || ''),
      owner: taskToEdit?.owner || '',
      reportingManager: taskToEdit?.reportingManager || '',
      due: taskToEdit?.due
        ? taskToEdit.due.includes('T')
          ? taskToEdit.due.split('T')[0]
          : taskToEdit.due
        : getTodayDateStringKolkata(),
      deadlineTime: initialDeadline?.time || '',
      deadlineTimezone: taskToEdit?.deadlineTimezone || 'Asia/Kolkata',
      reminderMinutesBefore:
        (taskToEdit?.reminderMinutesBefore as any) ??
        (initialDeadline?.time ? 30 : null),
      priority: taskToEdit?.priority || 'normal',
      subtasks: [],
    }
  }, [taskToEdit, initialBranch, allTeams, initialDeadline])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(isEditing ? editTaskSchema : createTaskSchema) as any,
    defaultValues,
    mode: 'onTouched',
  })

  // Synchronize values when taskToEdit changes
  useEffect(() => {
    if (isEditing && taskToEdit) {
      reset(defaultValues)
    }
  }, [taskToEdit, isEditing, reset, defaultValues])

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'subtasks',
  })

  // Watch branch, team, owner, due date, deadline, and subtasks
  const selectedBranch = useWatch({ control, name: 'branch' }) || initialBranch
  const selectedTeam = useWatch({ control, name: 'team' }) || ''
  const selectedOwner = useWatch({ control, name: 'owner' }) || ''
  const selectedDue = useWatch({ control, name: 'due' }) || getTodayDateStringKolkata()
  const selectedPriority = useWatch({ control, name: 'priority' }) || 'normal'
  const selectedDeadlineTime = useWatch({ control, name: 'deadlineTime' }) || ''
  const selectedReminder = useWatch({ control, name: 'reminderMinutesBefore' })
  const watchedSubtasks = useWatch({ control, name: 'subtasks' }) || []

  // Filter teams by selected branch
  const filteredTeams = useMemo(() => {
    if (!selectedBranch) return allTeams

    const matchingBranch = branches.find(
      (b) => b.id === selectedBranch || b.name === selectedBranch,
    )
    const branchIdToMatch = matchingBranch?.id || selectedBranch
    const branchNameToMatch = matchingBranch?.name || selectedBranch

    let teamsList = allTeams.filter(
      (t) =>
        t.branchId === branchIdToMatch ||
        t.branch === branchNameToMatch ||
        t.branchId === branchNameToMatch,
    )

    // For Team Lead, further restrict to authorized teams
    if (user?.role === 'Team Lead' && user.teams && user.teams.length > 0) {
      teamsList = teamsList.filter(
        (t) => user.teams.includes(t.id) || user.teams.includes(t.name),
      )
    }

    return teamsList
  }, [allTeams, selectedBranch, branches, user])

  // Resolve current team doc to find default Team Lead
  const currentTeamDoc = useMemo(() => {
    return allTeams.find((t) => t.id === selectedTeam || t.name === selectedTeam)
  }, [allTeams, selectedTeam])

  // Default suggested lead for selected team
  const defaultLeadId = currentTeamDoc?.leadId || currentTeamDoc?.lead || ''
  const defaultLeadName = currentTeamDoc?.leadName || currentTeamDoc?.lead || ''

  // Load team members for owner / subtask dropdowns
  const { data: teamMembers = [], isLoading: isLoadingMembers } = useTeamMembers(
    currentTeamDoc?.id || selectedTeam,
  )

  // Load eligible branch supervisors for Super Admin override
  const branchIdForSupervisors = useMemo(() => {
    const matchingBranch = branches.find(
      (b) => b.id === selectedBranch || b.name === selectedBranch,
    )
    return matchingBranch?.id || currentTeamDoc?.branchId || user?.branchId || ''
  }, [branches, selectedBranch, currentTeamDoc, user])

  const { data: branchSupervisors = [], isLoading: isLoadingSupervisors } =
    useBranchSupervisors(branchIdForSupervisors)

  // Automatically update default reporting manager when team changes in Create mode
  useEffect(() => {
    if (!isEditing && currentTeamDoc) {
      const suggested = defaultLeadId || defaultLeadName || ''
      setValue('reportingManager', suggested, { shouldValidate: true })
    }
  }, [selectedTeam, currentTeamDoc, defaultLeadId, defaultLeadName, isEditing, setValue])

  const createTaskMutation = useCreateTask()
  const updateTaskMutation = useUpdateTask(taskToEdit?.id || '')
  const isSaving =
    isSubmitting || createTaskMutation.isPending || updateTaskMutation.isPending

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  const confirmDiscard = () => {
    setShowDiscardConfirm(false)
    reset()
    onClose()
  }

  const handleModeChange = (newMode: 'single' | 'multiple') => {
    setMode(newMode)
    setValue('mode', newMode, { shouldValidate: true })
    setSubmitError(null)

    if (newMode === 'multiple' && fields.length === 0) {
      append([
        {
          owner: '',
          responsibilityLabel: 'Frontend Developer',
          title: '',
          note: '',
          due: selectedDue || getTodayDateStringKolkata(),
          deadlineTime: '',
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: null,
          priority: selectedPriority || 'normal',
          isRequired: true,
        },
        {
          owner: '',
          responsibilityLabel: 'Backend Developer',
          title: '',
          note: '',
          due: selectedDue || getTodayDateStringKolkata(),
          deadlineTime: '',
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: null,
          priority: selectedPriority || 'normal',
          isRequired: true,
        },
      ])
    }
  }

  const onSubmit = async (values: CreateTaskFormValues) => {
    setSubmitError(null)

    // Prevent assigning employee as their own reporting manager in single mode
    if (
      values.mode === 'single' &&
      values.owner &&
      values.reportingManager &&
      values.owner.toLowerCase() === values.reportingManager.toLowerCase()
    ) {
      setSubmitError('An employee cannot be assigned as their own reporting manager.')
      return
    }

    try {
      if (isEditing && taskToEdit) {
        await updateTaskMutation.mutateAsync({
          title: values.title,
          note: values.note,
          owner: values.owner,
          reportingManager: isSuperAdmin ? values.reportingManager : undefined,
          due: values.due,
          priority: values.priority,
          deadlineTime: values.deadlineTime ? values.deadlineTime : null,
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: values.deadlineTime
            ? (values.reminderMinutesBefore ?? 30)
            : null,
        })
      } else if (
        values.mode === 'multiple' &&
        values.subtasks &&
        values.subtasks.length > 0
      ) {
        await createTaskMutation.mutateAsync({
          title: values.title,
          branch: values.branch,
          team: values.team,
          reportingManager: values.reportingManager || undefined,
          due: values.due,
          priority: values.priority,
          note: values.note,
          deadlineTime: values.deadlineTime || undefined,
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: values.deadlineTime
            ? (values.reminderMinutesBefore ?? 30)
            : null,
          subtasks: values.subtasks.map((st) => ({
            title: st.title,
            owner: st.owner,
            responsibilityLabel: st.responsibilityLabel || undefined,
            note: st.note || undefined,
            due: st.due || values.due,
            priority: st.priority || values.priority,
            isRequired: st.isRequired !== false,
            deadlineTime: st.deadlineTime || undefined,
            deadlineTimezone: 'Asia/Kolkata',
            reminderMinutesBefore: st.deadlineTime
              ? (st.reminderMinutesBefore ?? 30)
              : null,
          })),
        })
      } else {
        await createTaskMutation.mutateAsync({
          title: values.title,
          branch: values.branch,
          team: values.team,
          owner: values.owner!,
          reportingManager: values.reportingManager || undefined,
          due: values.due,
          priority: values.priority,
          note: values.note,
          deadlineTime: values.deadlineTime || undefined,
          deadlineTimezone: 'Asia/Kolkata',
          reminderMinutesBefore: values.deadlineTime
            ? (values.reminderMinutesBefore ?? 30)
            : null,
        })
      }
      reset()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Failed to save task. Please try again.')
      }
    }
  }

  // Filter out selected owner from candidate reporting managers (in single mode)
  const eligibleReportingManagers = useMemo(() => {
    const list = [...branchSupervisors]

    if (defaultLeadId || defaultLeadName) {
      const exists = list.some(
        (m) =>
          m.id === defaultLeadId ||
          (defaultLeadName && m.name.toLowerCase() === defaultLeadName.toLowerCase()),
      )
      if (!exists && defaultLeadName) {
        list.unshift({
          id: defaultLeadId || defaultLeadName,
          name: `${defaultLeadName} (Team Lead)`,
          role: 'Team Lead',
        })
      }
    }

    if (mode === 'multiple' || !selectedOwner) return list
    return list.filter(
      (m) =>
        m.id !== selectedOwner &&
        m.name.toLowerCase() !== selectedOwner.toLowerCase() &&
        m.email?.toLowerCase() !== selectedOwner.toLowerCase(),
    )
  }, [branchSupervisors, defaultLeadId, defaultLeadName, selectedOwner, mode])

  return (
    <>
      <Sheet
        isOpen={true}
        onClose={handleCloseAttempt}
        title={
          isEditing
            ? 'Edit Task'
            : mode === 'multiple'
            ? 'Create Multi-Assignee Parent Task'
            : 'Create New Task'
        }
        description={
          isEditing
            ? `Editing task "${taskToEdit?.title}". Scope is locked.`
            : mode === 'multiple'
            ? 'Create a parent task with multiple independently assigned employee subtasks.'
            : 'Fill in the details below to delegate and track a single-assignee task.'
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isSaving}
              onClick={handleCloseAttempt}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isSaving}
              onClick={handleSubmit(onSubmit)}
            >
              {isEditing
                ? 'Save Changes'
                : mode === 'multiple'
                ? 'Create Parent Task & Assignments'
                : 'Create Task'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          {submitError && (
            <Alert variant="error" title="Submission Failed">
              {submitError}
            </Alert>
          )}

          {/* Mode Switcher (Create Mode Only) */}
          {!isEditing && (
            <div className="p-1 bg-slate-100 rounded-lg flex items-center gap-1 border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleModeChange('single')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer',
                  mode === 'single'
                    ? 'bg-white text-brand-blue shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                <User className="w-3.5 h-3.5" />
                <span>Single Assignment</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('multiple')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer',
                  mode === 'multiple'
                    ? 'bg-white text-brand-blue shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multiple Assignments</span>
              </button>
            </div>
          )}

          {/* =========================================================================
              SECTION A — TASK DETAILS
             ========================================================================= */}
          <div className="space-y-4">
            <div className="pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {mode === 'multiple'
                  ? 'Section A — Parent Task Details'
                  : 'Section A — Task Details'}
              </h3>
            </div>

            {/* Task Title (Single unique title input) */}
            <div>
              <Input
                {...register('title')}
                id="title"
                label={mode === 'multiple' ? 'Parent Task Title' : 'Task Title'}
                placeholder={
                  mode === 'multiple'
                    ? 'e.g. Build a New CRM Platform'
                    : 'e.g. Follow up on student visa documentation'
                }
                required
                autoFocus
                error={errors.title?.message}
                disabled={isSaving}
              />
            </div>

            {/* Instructions / Note */}
            <div>
              <Textarea
                {...register('note')}
                id="note"
                label={
                  mode === 'multiple'
                    ? 'Overall Project Description / Notes (Optional)'
                    : 'Instructions / Notes (Optional)'
                }
                placeholder={
                  mode === 'multiple'
                    ? 'High-level objective, milestones, or overall requirements...'
                    : 'Add relevant context, checklist items, or links...'
                }
                rows={3}
                error={errors.note?.message}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* =========================================================================
              SECTION B — SCOPE & SUPERVISION
             ========================================================================= */}
          <div className="space-y-4 pt-2">
            <div className="pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Section B — Scope &amp; Supervision
              </h3>
            </div>

            {/* Branch Selection */}
            <div>
              {isEditing ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Branch
                  </label>
                  <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center justify-between">
                    <span>{taskToEdit?.branch || 'Headquarters / All'}</span>
                    <span className="text-[11px] text-slate-400 italic">Locked</span>
                  </div>
                </div>
              ) : isSuperAdmin ? (
                <div>
                  <Select
                    {...register('branch', {
                      onChange: () => {
                        setValue('team', '', { shouldValidate: true })
                        setValue('owner', '', { shouldValidate: true })
                        setValue('reportingManager', '', { shouldValidate: true })
                        if (mode === 'multiple') {
                          replace([
                            {
                              owner: '',
                              responsibilityLabel: 'Frontend Developer',
                              title: '',
                              note: '',
                              due: selectedDue || getTodayDateStringKolkata(),
                              deadlineTime: '',
                              deadlineTimezone: 'Asia/Kolkata',
                              reminderMinutesBefore: null,
                              priority: selectedPriority || 'normal',
                              isRequired: true,
                            },
                            {
                              owner: '',
                              responsibilityLabel: 'Backend Developer',
                              title: '',
                              note: '',
                              due: selectedDue || getTodayDateStringKolkata(),
                              deadlineTime: '',
                              deadlineTimezone: 'Asia/Kolkata',
                              reminderMinutesBefore: null,
                              priority: selectedPriority || 'normal',
                              isRequired: true,
                            },
                          ])
                        }
                      },
                    })}
                    id="branch"
                    label="Branch"
                    required
                    error={errors.branch?.message}
                    disabled={isSaving || isLoadingBranches}
                  >
                    <option value="">Select a branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                  {isLoadingBranches && (
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Loading branches...
                    </span>
                  )}
                  {isBranchesError && (
                    <span className="text-[11px] text-red-500 mt-1 block">
                      Failed to load branches.
                    </span>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Branch
                  </label>
                  <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center justify-between">
                    <span>
                      {branches.find(
                        (b) =>
                          b.id === user?.branchId ||
                          b.name === (user as any)?.branch,
                      )?.name ||
                        (user as any)?.branch ||
                        'Assigned Branch'}
                    </span>
                    <span className="text-[11px] text-slate-400 italic">Authorized</span>
                  </div>
                </div>
              )}
            </div>

            {/* Team Selection */}
            <div>
              {isEditing ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Team
                  </label>
                  <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center justify-between">
                    <span>{taskToEdit?.team || 'N/A'}</span>
                    <span className="text-[11px] text-slate-400 italic">Locked</span>
                  </div>
                </div>
              ) : (
                <div>
                  <Select
                    {...register('team', {
                      onChange: () => {
                        setValue('owner', '', { shouldValidate: true })
                        if (mode === 'multiple') {
                          replace([
                            {
                              owner: '',
                              responsibilityLabel: 'Frontend Developer',
                              title: '',
                              note: '',
                              due: selectedDue || getTodayDateStringKolkata(),
                              deadlineTime: '',
                              deadlineTimezone: 'Asia/Kolkata',
                              reminderMinutesBefore: null,
                              priority: selectedPriority || 'normal',
                              isRequired: true,
                            },
                            {
                              owner: '',
                              responsibilityLabel: 'Backend Developer',
                              title: '',
                              note: '',
                              due: selectedDue || getTodayDateStringKolkata(),
                              deadlineTime: '',
                              deadlineTimezone: 'Asia/Kolkata',
                              reminderMinutesBefore: null,
                              priority: selectedPriority || 'normal',
                              isRequired: true,
                            },
                          ])
                        }
                      },
                    })}
                    id="team"
                    label="Team"
                    required
                    error={errors.team?.message}
                    disabled={isSaving || isLoadingTeams}
                  >
                    <option value="">Select a team</option>
                    {filteredTeams.length > 0 ? (
                      filteredTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.leadName ? `(Lead: ${t.leadName})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        {isLoadingTeams
                          ? 'Loading teams...'
                          : selectedBranch
                          ? 'No teams found for this branch'
                          : 'Select a branch first'}
                      </option>
                    )}
                  </Select>
                  {isTeamsError && (
                    <span className="text-[11px] text-red-500 mt-1 block">
                      Failed to load teams.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Reporting Manager Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="reportingManager"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Reporting Manager
                </label>
                {defaultLeadName && (
                  <span className="text-[11px] font-medium text-brand-blue bg-blue-50 px-2 py-0.5 rounded-full">
                    Default: {defaultLeadName} (Team Lead)
                  </span>
                )}
              </div>

              {isSuperAdmin ? (
                <div>
                  <Select
                    {...register('reportingManager')}
                    id="reportingManager"
                    error={errors.reportingManager?.message}
                    disabled={isSaving || isLoadingSupervisors}
                  >
                    <option value="">
                      {defaultLeadName
                        ? `Default: ${defaultLeadName} (Team Lead)`
                        : 'Select a reporting manager'}
                    </option>
                    {eligibleReportingManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.role ? `[${m.role}]` : ''} {m.email ? `(${m.email})` : ''}
                      </option>
                    ))}
                  </Select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Super Admin may retain default Team Lead or designate an authorized branch supervisor.
                  </span>
                </div>
              ) : (
                <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 flex items-center justify-between">
                  <span>
                    {defaultLeadName
                      ? `${defaultLeadName} (Team Lead)`
                      : taskToEdit?.reportingManager || 'Standard Team Lead'}
                  </span>
                  <span className="text-[11px] text-slate-400 italic">Supervisor</span>
                </div>
              )}
            </div>
          </div>

          {/* =========================================================================
              SECTION C — ASSIGNMENT
             ========================================================================= */}
          {mode === 'single' ? (
            <div className="space-y-4 pt-2">
              <div className="pb-1 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Section C — Assignment
                </h3>
              </div>

              <div>
                <label
                  htmlFor="owner"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Assigned To <span className="text-red-500">*</span>
                </label>
                {isLoadingMembers ? (
                  <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Loading team members...</span>
                  </div>
                ) : teamMembers.length > 0 ? (
                  <Select
                    {...register('owner')}
                    id="owner"
                    error={errors.owner?.message}
                    disabled={isSaving}
                  >
                    <option value="">Select team member</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name || m.id}>
                        {m.name} {m.email ? `(${m.email})` : ''}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...register('owner')}
                    id="owner"
                    placeholder="Enter employee name or email"
                    required
                    helperText={
                      selectedTeam
                        ? 'No active members registered in this team. Enter user name or email.'
                        : 'Select a team above to view eligible team members.'
                    }
                    error={errors.owner?.message}
                    disabled={isSaving}
                  />
                )}
                <span className="text-[11px] text-slate-400 mt-1 block">
                  The employee directly responsible for executing this task.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Section C — Assignment ({fields.length} Subtasks)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Assign individual responsibilities and specific deadlines to active team members.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      owner: '',
                      responsibilityLabel: '',
                      title: '',
                      note: '',
                      due: selectedDue || getTodayDateStringKolkata(),
                      deadlineTime: '',
                      deadlineTimezone: 'Asia/Kolkata',
                      reminderMinutesBefore: null,
                      priority: selectedPriority || 'normal',
                      isRequired: true,
                    })
                  }
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Member
                </Button>
              </div>

              {errors.subtasks?.root?.message && (
                <p className="text-xs text-red-500 font-medium">
                  {errors.subtasks.root.message}
                </p>
              )}

              <div className="space-y-3.5">
                {fields.map((field, index) => {
                  const otherAssignedOwners = watchedSubtasks
                    ?.map((s, i) => (i !== index ? s?.owner : null))
                    .filter(Boolean) as string[]

                  const subtaskTime = watchedSubtasks?.[index]?.deadlineTime

                  return (
                    <div
                      key={field.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3 relative transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[11px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            Assignment #{index + 1}
                          </span>
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                            title="Remove assignment"
                            aria-label={`Remove assignment ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Row 1: Assign To & Responsibility */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor={`subtask-owner-${index}`}
                            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                          >
                            Assign To <span className="text-red-500">*</span>
                          </label>
                          <Select
                            {...register(`subtasks.${index}.owner` as const)}
                            id={`subtask-owner-${index}`}
                            error={errors.subtasks?.[index]?.owner?.message}
                            disabled={isSaving || isLoadingMembers}
                          >
                            <option value="">Select team member</option>
                            {teamMembers.map((m) => {
                              const val = m.name || m.id
                              const isTaken =
                                otherAssignedOwners.includes(val) ||
                                otherAssignedOwners.includes(m.id)
                              return (
                                <option key={m.id} value={val} disabled={isTaken}>
                                  {m.name} {isTaken ? '(Already assigned)' : ''}
                                </option>
                              )
                            })}
                          </Select>
                        </div>

                        <div>
                          <Input
                            {...register(
                              `subtasks.${index}.responsibilityLabel` as const,
                            )}
                            id={`subtask-role-${index}`}
                            label="Responsibility / Role"
                            placeholder="e.g. Frontend Developer, QA"
                            error={
                              errors.subtasks?.[index]?.responsibilityLabel?.message
                            }
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      {/* Row 2: Subtask Title */}
                      <div>
                        <Input
                          {...register(`subtasks.${index}.title` as const)}
                          id={`subtask-title-${index}`}
                          label="Subtask Title"
                          placeholder="e.g. Build Login & Contacts Module"
                          required
                          error={errors.subtasks?.[index]?.title?.message}
                          disabled={isSaving}
                        />
                      </div>

                      {/* Row 3: Work Instructions */}
                      <div>
                        <Textarea
                          {...register(`subtasks.${index}.note` as const)}
                          id={`subtask-note-${index}`}
                          label="Work Instructions (Optional)"
                          placeholder="Specific deliverables, links, or instructions for this member..."
                          rows={2}
                          error={errors.subtasks?.[index]?.note?.message}
                          disabled={isSaving}
                        />
                      </div>

                      {/* Row 4: Due Date & Deadline Time */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Input
                            {...register(`subtasks.${index}.due` as const)}
                            id={`subtask-due-${index}`}
                            type="date"
                            label="Subtask Due Date"
                            required
                            error={errors.subtasks?.[index]?.due?.message}
                            disabled={isSaving}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label
                              htmlFor={`subtask-time-${index}`}
                              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                            >
                              Deadline Time <span className="text-slate-400 font-normal lowercase">(opt)</span>
                            </label>
                            {subtaskTime && (
                              <span className="text-[11px] font-semibold text-brand-blue bg-blue-50 px-1.5 py-0.5 rounded">
                                {formatTimeAMPM(subtaskTime)} IST
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              id={`subtask-time-${index}`}
                              {...register(`subtasks.${index}.deadlineTime` as const, {
                                onChange: (e) => {
                                  if (e.target.value && !watchedSubtasks?.[index]?.reminderMinutesBefore) {
                                    setValue(`subtasks.${index}.reminderMinutesBefore` as const, 30)
                                  } else if (!e.target.value) {
                                    setValue(`subtasks.${index}.reminderMinutesBefore` as const, null)
                                  }
                                },
                              })}
                              disabled={isSaving}
                              className="h-10 px-3 bg-surface border border-border-subtle rounded-lg text-sm text-text-primary focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 flex-1"
                            />
                            {subtaskTime && (
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`subtasks.${index}.deadlineTime` as const, '')
                                  setValue(`subtasks.${index}.reminderMinutesBefore` as const, null)
                                }}
                                className="h-10 px-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 5: Reminder, Priority & Required Checkbox */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label
                            htmlFor={`subtask-reminder-${index}`}
                            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
                          >
                            Advance Reminder
                          </label>
                          <Select
                            {...register(
                              `subtasks.${index}.reminderMinutesBefore` as const,
                            )}
                            id={`subtask-reminder-${index}`}
                            disabled={isSaving || !subtaskTime}
                          >
                            <option value="30">30 mins before (Default)</option>
                            <option value="60">60 mins before</option>
                            <option value="">No reminder</option>
                          </Select>
                        </div>

                        <div>
                          <Select
                            {...register(`subtasks.${index}.priority` as const)}
                            id={`subtask-priority-${index}`}
                            label="Priority"
                            disabled={isSaving}
                          >
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </Select>
                        </div>

                        <div className="pb-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                            <input
                              type="checkbox"
                              {...register(
                                `subtasks.${index}.isRequired` as const,
                              )}
                              className="rounded text-brand-blue focus:ring-brand-blue"
                              disabled={isSaving}
                            />
                            <span>Required for Parent Completion</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {teamMembers.length > 0 && fields.length < teamMembers.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      owner: '',
                      responsibilityLabel: '',
                      title: '',
                      note: '',
                      due: selectedDue || getTodayDateStringKolkata(),
                      deadlineTime: '',
                      deadlineTimezone: 'Asia/Kolkata',
                      reminderMinutesBefore: null,
                      priority: selectedPriority || 'normal',
                      isRequired: true,
                    })
                  }
                  className="w-full border-dashed"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  + Add Another Member Assignment
                </Button>
              )}
            </div>
          )}

          {/* =========================================================================
              SECTION D — DEADLINE & REMINDER
             ========================================================================= */}
          <div className="space-y-4 pt-2">
            <div className="pb-1 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {mode === 'multiple'
                  ? 'Section D — Parent Schedule & Reminder'
                  : 'Section D — Deadline & Reminder'}
              </h3>
              {!canModifyDeadline && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Lock className="w-3 h-3" />
                  <span>Deadline Locked</span>
                </span>
              )}
            </div>

            {!canModifyDeadline && (
              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Deadline modification restricted</span>
                  <span className="text-amber-800">
                    Only Team Leads, Reporting Managers, or the Task Creator are authorized to change deadlines.
                  </span>
                </div>
              </div>
            )}

            {/* Row 1: Due Date & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  {...register('due')}
                  id="due"
                  type="date"
                  label={
                    mode === 'multiple' ? 'Overall Parent Due Date' : 'Due Date'
                  }
                  required
                  error={errors.due?.message}
                  disabled={isSaving || !canModifyDeadline}
                />
              </div>

              <div>
                <Select
                  {...register('priority')}
                  id="priority"
                  label="Priority"
                  required
                  error={errors.priority?.message}
                  disabled={isSaving}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </Select>
              </div>
            </div>

            {/* Row 2: Deadline Time & Advance Reminder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Exact Deadline Time */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="deadlineTime"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Deadline Time <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  {selectedDeadlineTime && (
                    <span className="text-[11px] font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAMPM(selectedDeadlineTime)} IST</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    id="deadlineTime"
                    {...register('deadlineTime', {
                      onChange: (e) => {
                        const val = e.target.value
                        if (val && !selectedReminder) {
                          setValue('reminderMinutesBefore', 30, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        } else if (!val) {
                          setValue('reminderMinutesBefore', null, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      },
                    })}
                    disabled={isSaving || !canModifyDeadline}
                    className="h-10 px-3 bg-surface border border-border-subtle rounded-lg text-sm text-text-primary focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:bg-slate-50 disabled:text-text-muted flex-1"
                  />
                  {selectedDeadlineTime && canModifyDeadline && (
                    <button
                      type="button"
                      onClick={() => {
                        setValue('deadlineTime', '', {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                        setValue('reminderMinutesBefore', null, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }}
                      className="h-10 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick Presets for clean, fast selection */}
                {canModifyDeadline && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400">Presets:</span>
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset.time}
                        type="button"
                        onClick={() => {
                          setValue('deadlineTime', preset.time, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                          if (!selectedReminder) {
                            setValue('reminderMinutesBefore', 30, {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                        }}
                        className={cn(
                          'text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer',
                          selectedDeadlineTime === preset.time
                            ? 'bg-blue-50 border-brand-blue text-brand-blue font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}

                {errors.deadlineTime?.message && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.deadlineTime.message}
                  </p>
                )}
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Preserves calendar due date and records exact UTC instant (Asia/Kolkata).
                </span>
              </div>

              {/* Advance Reminder Policy */}
              <div>
                <label
                  htmlFor="reminderMinutesBefore"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Advance Reminder
                </label>
                <Select
                  {...register('reminderMinutesBefore')}
                  id="reminderMinutesBefore"
                  disabled={isSaving || !canModifyDeadline || !selectedDeadlineTime}
                  error={errors.reminderMinutesBefore?.message}
                >
                  <option value="30">30 minutes before (Default)</option>
                  <option value="60">60 minutes before</option>
                  <option value="">No advance reminder</option>
                </Select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {!selectedDeadlineTime
                    ? 'Enter an exact deadline time above to enable advance reminders.'
                    : 'System policy for automated upcoming-deadline alerts.'}
                </span>
              </div>
            </div>
          </div>
        </form>
      </Sheet>

      {/* Discard unsaved changes confirmation modal */}
      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Unsaved Changes?"
        description="You have entered information in this task form. Discarding will lose these changes."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Continue Editing
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDiscard}>
              Discard Changes
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to close this form? Any modifications you made will not be saved.
        </p>
      </Modal>
    </>
  )
}

export function TaskFormSheet({
  isOpen,
  onClose,
  taskToEdit,
}: TaskFormSheetProps) {
  if (!isOpen) return null
  return <TaskFormSheetInner onClose={onClose} taskToEdit={taskToEdit} />
}
