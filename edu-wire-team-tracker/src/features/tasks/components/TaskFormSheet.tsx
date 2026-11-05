import { useState, useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
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
import { getTodayDateStringKolkata } from '../utils/dateUtils'
import type { Task } from '../types/task.types'

export interface TaskFormSheetProps {
  isOpen: boolean
  onClose: () => void
  taskToEdit?: Task | null
}

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

  const defaultValues: CreateTaskFormValues = {
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
    priority: taskToEdit?.priority || 'normal',
  }

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

  // Watch branch, team, and owner for dynamic cascading
  const selectedBranch = useWatch({ control, name: 'branch' }) || initialBranch
  const selectedTeam = useWatch({ control, name: 'team' }) || ''
  const selectedOwner = useWatch({ control, name: 'owner' }) || ''

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

    // For Team Lead, further restrict to only their authorized teams
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

  // Load team members for owner dropdown
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
  const isSaving = isSubmitting || createTaskMutation.isPending || updateTaskMutation.isPending

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

  const onSubmit = async (values: CreateTaskFormValues) => {
    setSubmitError(null)

    // Prevent assigning employee as their own reporting manager
    if (
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
        })
      } else {
        await createTaskMutation.mutateAsync({
          title: values.title,
          branch: values.branch,
          team: values.team,
          owner: values.owner,
          reportingManager: values.reportingManager || undefined,
          due: values.due,
          priority: values.priority,
          note: values.note,
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

  // Filter out the selected owner from candidate reporting managers
  const eligibleReportingManagers = useMemo(() => {
    const list = [...branchSupervisors]

    // Ensure default team lead is present in the list
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

    // Filter out user matching the current owner
    if (!selectedOwner) return list
    return list.filter(
      (m) =>
        m.id !== selectedOwner &&
        m.name.toLowerCase() !== selectedOwner.toLowerCase() &&
        m.email?.toLowerCase() !== selectedOwner.toLowerCase(),
    )
  }, [branchSupervisors, defaultLeadId, defaultLeadName, selectedOwner])

  return (
    <>
      <Sheet
        isOpen={true}
        onClose={handleCloseAttempt}
        title={isEditing ? 'Edit Task' : 'Create New Task'}
        description={
          isEditing
            ? `Editing task "${taskToEdit?.title}". Team and branch are locked.`
            : 'Fill in the details below to delegate and track a new task.'
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
              {isEditing ? 'Save Changes' : 'Create Task'}
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

          {/* =========================================================================
              SECTION A — TASK DETAILS
             ========================================================================= */}
          <div className="space-y-4">
            <div className="pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Section A — Task Details
              </h3>
            </div>

            {/* 1. Task Title */}
            <div>
              <Input
                {...register('title')}
                id="title"
                label="Task Title"
                placeholder="e.g. Follow up on student visa documentation"
                required
                autoFocus
                error={errors.title?.message}
                disabled={isSaving}
              />
            </div>

            {/* 2. Instructions / Note (Optional) */}
            <div>
              <Textarea
                {...register('note')}
                id="note"
                label="Instructions / Notes (Optional)"
                placeholder="Add relevant context, checklist items, or links..."
                rows={3}
                error={errors.note?.message}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* =========================================================================
              SECTION B — ASSIGNMENT
             ========================================================================= */}
          <div className="space-y-4 pt-2">
            <div className="pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Section B — Assignment
              </h3>
            </div>

            {/* 3. Branch Selection */}
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
                        // Reset dependent team, owner, and reporting manager selections
                        setValue('team', '', { shouldValidate: true })
                        setValue('owner', '', { shouldValidate: true })
                        setValue('reportingManager', '', { shouldValidate: true })
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

            {/* 4. Team Selection */}
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
                        // Reset owner when team changes
                        setValue('owner', '', { shouldValidate: true })
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

            {/* 5. Task Owner Selection */}
            <div>
              <label
                htmlFor="owner"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Task Owner <span className="text-red-500">*</span>
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
                The employee responsible for performing and completing the task.
              </span>
            </div>

            {/* 6. Reporting Manager Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="reportingManager"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Reporting Manager
                </label>
                {defaultLeadName && (
                  <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
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
                    Super Admin may retain the default Team Lead or designate another eligible supervisor in this branch.
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
              SECTION C — SCHEDULE
             ========================================================================= */}
          <div className="space-y-4 pt-2">
            <div className="pb-1 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Section C — Schedule
              </h3>
            </div>

            {/* 7. Due Date & 8. Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  {...register('due')}
                  id="due"
                  type="date"
                  label="Due Date"
                  required
                  error={errors.due?.message}
                  disabled={isSaving}
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
