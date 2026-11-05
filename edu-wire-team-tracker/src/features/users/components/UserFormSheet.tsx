import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, ShieldAlert, Check } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { createUserSchema, type CreateUserFormValues } from '../schemas/userAdminSchemas'
import { useCreateUser, useUpdateUser } from '../hooks/useUserMutations'
import { useBranches, useTeams } from '@/features/tasks/hooks/useMetadata'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { ManagedUser } from '../types/userAdmin.types'

export interface UserFormSheetProps {
  isOpen: boolean
  onClose: () => void
  userToEdit?: ManagedUser | null
}

function UserFormSheetInner({
  onClose,
  userToEdit,
}: {
  onClose: () => void
  userToEdit?: ManagedUser | null
}) {
  const { user: currentAuthUser } = useAuth()
  const isEditing = Boolean(userToEdit)
  const isSelf = isEditing && userToEdit?.id === currentAuthUser?.id
  const isBranchAdmin = currentAuthUser?.role === 'Branch Admin'

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: branches = [] } = useBranches()
  const { data: allTeams = [] } = useTeams()

  // Allowed roles depending on administrator status
  const roleOptions = isBranchAdmin
    ? [
        { value: 'Team Lead', label: 'Team Lead' },
        { value: 'Member', label: 'Member' },
      ]
    : [
        { value: 'Super Admin', label: 'Super Admin' },
        { value: 'Branch Admin', label: 'Branch Admin' },
        { value: 'Team Lead', label: 'Team Lead' },
        { value: 'Member', label: 'Member' },
      ]

  // Default values
  const defaultBranch = userToEdit?.branch || (isBranchAdmin ? currentAuthUser?.branchId || '' : branches[0]?.id || '')

  const defaultValues: CreateUserFormValues = {
    name: userToEdit?.name || '',
    email: userToEdit?.email || '',
    phone: userToEdit?.phone || '',
    role: userToEdit?.role || (isBranchAdmin ? 'Member' : 'Member'),
    branch: defaultBranch,
    teams: userToEdit?.teams || [],
    temporaryPassword: '',
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues,
    mode: 'onTouched',
  })

  // Watch branch to filter teams restricted to this branch
  const selectedBranch = useWatch({ control, name: 'branch' }) || ''
  const selectedTeams = useWatch({ control, name: 'teams' }) || []

  const eligibleTeams = allTeams.filter((t) => !t.branchId || !selectedBranch || t.branchId === selectedBranch)

  const createUserMutation = useCreateUser()
  const updateUserMutation = useUpdateUser(userToEdit?.id || '')

  const isSaving = isSubmitting || createUserMutation.isPending || updateUserMutation.isPending

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

  // Toggle team selection
  const handleToggleTeam = (teamId: string) => {
    const next = selectedTeams.includes(teamId)
      ? selectedTeams.filter((id) => id !== teamId)
      : [...selectedTeams, teamId]
    setValue('teams', next, { shouldDirty: true })
  }

  const onSubmit = async (values: CreateUserFormValues) => {
    setSubmitError(null)
    try {
      if (isEditing && userToEdit) {
        await updateUserMutation.mutateAsync({
          name: values.name,
          phone: values.phone,
          role: isSelf ? userToEdit.role : values.role, // Self role change guard
          branch: isBranchAdmin ? (userToEdit.branch || '') : values.branch,
          teams: values.teams,
        })
      } else {
        await createUserMutation.mutateAsync({
          name: values.name,
          email: values.email,
          phone: values.phone,
          role: values.role,
          branch: values.branch,
          teams: values.teams,
          temporaryPassword: values.temporaryPassword,
        })
      }
      reset()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Failed to save user account. Please check inputs and try again.')
      }
    }
  }

  return (
    <>
      <Sheet
        isOpen={true}
        onClose={handleCloseAttempt}
        title={isEditing ? `Edit User: ${userToEdit?.name}` : 'Provision Staff Account'}
        description={
          isEditing
            ? 'Update staff profile and branch/team assignments.'
            : 'Create an internal employee profile. A temporary password must be provided.'
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
              {isEditing ? 'Save Changes' : 'Create Account'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {submitError && (
            <Alert variant="error" title="Action Failed">
              {submitError}
            </Alert>
          )}

          {isSelf && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                You are editing your own account. Modifying your own role is restricted by system security policies.
              </span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <Input
              {...register('name')}
              id="name"
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              required
              autoFocus
              error={errors.name?.message}
              disabled={isSaving}
            />
          </div>

          {/* Email Address */}
          <div>
            <Input
              {...register('email')}
              id="email"
              type="email"
              label="Email Address"
              placeholder="rahul@company.com"
              required
              error={errors.email?.message}
              disabled={isSaving || isEditing}
              helperText={isEditing ? 'Email addresses cannot be modified directly.' : undefined}
            />
          </div>

          {/* Phone Number */}
          <div>
            <Input
              {...register('phone')}
              id="phone"
              type="tel"
              label="Phone Number (Optional)"
              placeholder="+91 98765 43210"
              error={errors.phone?.message}
              disabled={isSaving}
            />
          </div>

          {/* Role Selection */}
          <div>
            <Select
              {...register('role')}
              id="role"
              label="Assigned Role"
              required
              disabled={isSaving || isSelf}
              error={errors.role?.message}
              helperText={
                isSelf
                  ? 'Self-role modification is disabled.'
                  : isBranchAdmin
                  ? 'Branch Admins can only assign Team Lead and Member roles.'
                  : undefined
              }
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Branch Selection */}
          <div>
            {isBranchAdmin ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Branch
                </label>
                <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 flex items-center justify-between">
                  <span>{currentAuthUser?.branchId || userToEdit?.branch || 'Current Branch'}</span>
                  <span className="text-[11px] text-slate-400 italic">Branch Admin Scope</span>
                </div>
              </div>
            ) : (
              <Select
                {...register('branch', {
                  onChange: () => {
                    // Reset teams when branch changes
                    setValue('teams', [], { shouldDirty: true })
                  },
                })}
                id="branch"
                label="Branch"
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

          {/* Teams Multi-select (Limited to Branch) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Assigned Teams
            </label>
            {eligibleTeams.length > 0 ? (
              <div className="p-2 border border-slate-200 rounded-lg max-h-36 overflow-y-auto space-y-1 bg-slate-50/50">
                {eligibleTeams.map((team) => {
                  const isChecked = selectedTeams.includes(team.name || team.id)
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => handleToggleTeam(team.name || team.id)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-white text-xs text-left transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-slate-800">{team.name}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-[#1D4ED8]" />}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-lg">
                No teams registered for this branch yet.
              </p>
            )}
          </div>

          {/* Temporary Password (on Create only) */}
          {!isEditing && (
            <div className="pt-2 border-t border-slate-100">
              <Input
                {...register('temporaryPassword')}
                id="temporaryPassword"
                type="password"
                label="Initial Temporary Password"
                placeholder="Min 8 characters, letters & numbers"
                required
                showPasswordToggle
                leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />}
                error={errors.temporaryPassword?.message}
                disabled={isSaving}
                helperText="The user will be required to change this password upon their first sign-in."
              />
            </div>
          )}
        </form>
      </Sheet>

      {/* Discard confirmation modal */}
      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Unsaved Changes?"
        description="Closing this sheet will discard any unsubmitted user details."
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

export function UserFormSheet({ isOpen, onClose, userToEdit }: UserFormSheetProps) {
  if (!isOpen) return null
  return <UserFormSheetInner onClose={onClose} userToEdit={userToEdit} />
}

