import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { teamSchema, type TeamFormValues } from '../schemas/organizationSchemas'
import { useCreateTeam, useUpdateTeam } from '../hooks/useOrganization'
import { useBranches, useTeamMembers } from '@/features/tasks/hooks/useMetadata'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { TeamItem } from '../types/organization.types'

export interface TeamFormSheetProps {
  isOpen: boolean
  onClose: () => void
  teamToEdit?: TeamItem | null
}

function TeamFormSheetInner({
  onClose,
  teamToEdit,
}: {
  onClose: () => void
  teamToEdit?: TeamItem | null
}) {
  const { user: currentAuthUser } = useAuth()
  const isEditing = Boolean(teamToEdit)
  const isBranchAdmin = currentAuthUser?.role === 'Branch Admin'

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: branches = [] } = useBranches()

  const defaultBranch = teamToEdit?.branch || (isBranchAdmin ? currentAuthUser?.branchId || '' : branches[0]?.id || '')

  const defaultValues: TeamFormValues = {
    name: teamToEdit?.name || '',
    branch: defaultBranch,
    lead: teamToEdit?.lead || teamToEdit?.leadName || '',
    isActive: teamToEdit ? (teamToEdit.status === 'active' || teamToEdit.isActive !== false) : true,
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues,
    mode: 'onTouched',
  })

  // Watch branch to fetch eligible staff leads
  const selectedBranch = useWatch({ control, name: 'branch' }) || ''
  const { data: eligibleMembers = [] } = useTeamMembers(teamToEdit?.id || selectedBranch)

  const createMutation = useCreateTeam()
  const updateMutation = useUpdateTeam(teamToEdit?.id || '')

  const isSaving = isSubmitting || createMutation.isPending || updateMutation.isPending

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

  const onSubmit = async (values: TeamFormValues) => {
    setSubmitError(null)
    try {
      if (isEditing && teamToEdit) {
        await updateMutation.mutateAsync({
          name: values.name,
          branch: isBranchAdmin ? (teamToEdit.branch || '') : values.branch,
          lead: values.lead,
          isActive: values.isActive,
        })
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          branch: values.branch,
          lead: values.lead,
          isActive: values.isActive,
        })
      }
      reset()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Failed to save team. Please check inputs and try again.')
      }
    }
  }

  return (
    <>
      <Sheet
        isOpen={true}
        onClose={handleCloseAttempt}
        title={isEditing ? `Edit Team: ${teamToEdit?.name}` : 'Create Functional Team'}
        description={
          isEditing
            ? 'Update functional unit attributes and lead appointment.'
            : 'Register a new functional team assigned to a branch.'
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
              {isEditing ? 'Save Changes' : 'Create Team'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {submitError && (
            <Alert variant="error" title="Submission Failed">
              {submitError}
            </Alert>
          )}

          {/* Team Name */}
          <div>
            <Input
              {...register('name')}
              id="team-name"
              label="Team Name"
              placeholder="e.g. Visa Processing Desk"
              required
              autoFocus
              error={errors.name?.message}
              disabled={isSaving}
            />
          </div>

          {/* Branch Selection */}
          <div>
            {isBranchAdmin ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Branch
                </label>
                <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 flex items-center justify-between">
                  <span>{currentAuthUser?.branchId || teamToEdit?.branch || 'Current Branch'}</span>
                  <span className="text-[11px] text-slate-400 italic">Branch Admin Scope</span>
                </div>
              </div>
            ) : (
              <Select
                {...register('branch', {
                  onChange: () => {
                    setValue('lead', '', { shouldDirty: true })
                  },
                })}
                id="team-branch"
                label="Assigned Branch"
                required
                disabled={isSaving}
                error={errors.branch?.message}
              >
                <option value="">Select a branch</option>
                {branches.length > 0 ? (
                  branches.map((b) => (
                    <option key={b.id} value={b.name || b.id}>
                      {b.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Headquarters">Headquarters</option>
                    <option value="Bhopal">Bhopal</option>
                    <option value="Indore">Indore</option>
                  </>
                )}
              </Select>
            )}
          </div>

          {/* Assigned Team Lead */}
          <div>
            {eligibleMembers.length > 0 ? (
              <Select
                {...register('lead')}
                id="team-lead"
                label="Team Lead (Optional)"
                disabled={isSaving}
              >
                <option value="">Unassigned (Select later)</option>
                {eligibleMembers.map((m) => (
                  <option key={m.id} value={m.name || m.id}>
                    {m.name} {m.email ? `(${m.email})` : ''}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...register('lead')}
                id="team-lead"
                label="Team Lead (Optional)"
                placeholder="Enter lead name or appointment"
                disabled={isSaving}
                helperText="Eligible team members from this branch will populate once the server returns staff records."
              />
            )}
          </div>

          {/* Operational Status */}
          <div>
            <Select
              {...register('isActive', {
                setValueAs: (v) => v === 'true' || v === true,
              })}
              id="team-status"
              label="Team Status"
              disabled={isSaving}
            >
              <option value="true">Active Unit</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
        </form>
      </Sheet>

      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Team Changes?"
        description="Closing this form will lose unsubmitted team details."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowDiscardConfirm(false)}>
              Continue Editing
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDiscard}>
              Discard Changes
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to dismiss this form? Entered details will not be saved.
        </p>
      </Modal>
    </>
  )
}

export function TeamFormSheet({ isOpen, onClose, teamToEdit }: TeamFormSheetProps) {
  if (!isOpen) return null
  return <TeamFormSheetInner onClose={onClose} teamToEdit={teamToEdit} />
}

