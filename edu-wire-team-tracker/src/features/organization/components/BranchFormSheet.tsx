import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { branchSchema, type BranchFormValues } from '../schemas/organizationSchemas'
import { useCreateBranch, useUpdateBranch } from '../hooks/useOrganization'
import type { BranchItem } from '../types/organization.types'

export interface BranchFormSheetProps {
  isOpen: boolean
  onClose: () => void
  branchToEdit?: BranchItem | null
}

function BranchFormSheetInner({
  onClose,
  branchToEdit,
}: {
  onClose: () => void
  branchToEdit?: BranchItem | null
}) {
  const isEditing = Boolean(branchToEdit)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const defaultValues: BranchFormValues = {
    name: branchToEdit?.name || '',
    city: branchToEdit?.city || '',
    isActive: branchToEdit ? (branchToEdit.status === 'active' || branchToEdit.isActive !== false) : true,
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues,
    mode: 'onTouched',
  })

  const createMutation = useCreateBranch()
  const updateMutation = useUpdateBranch(branchToEdit?.id || '')

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

  const onSubmit = async (values: BranchFormValues) => {
    setSubmitError(null)
    try {
      if (isEditing && branchToEdit) {
        await updateMutation.mutateAsync({
          name: values.name,
          city: values.city,
          isActive: values.isActive,
        })
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          city: values.city,
          isActive: values.isActive,
        })
      }
      reset()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Failed to save branch. Please check inputs and try again.')
      }
    }
  }

  return (
    <>
      <Sheet
        isOpen={true}
        onClose={handleCloseAttempt}
        title={isEditing ? `Edit Branch: ${branchToEdit?.name}` : 'Register New Branch'}
        description={
          isEditing
            ? 'Update branch office location and status.'
            : 'Register a new regional or physical branch office for the organization.'
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
              {isEditing ? 'Save Changes' : 'Create Branch'}
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

          {/* Branch Name */}
          <div>
            <Input
              {...register('name')}
              id="branch-name"
              label="Branch Name"
              placeholder="e.g. Bhopal Center"
              required
              autoFocus
              error={errors.name?.message}
              disabled={isSaving}
            />
          </div>

          {/* City */}
          <div>
            <Input
              {...register('city')}
              id="branch-city"
              label="City / Location"
              placeholder="e.g. Bhopal"
              required
              error={errors.city?.message}
              disabled={isSaving}
            />
          </div>

          {/* Active Status */}
          <div>
            <Select
              {...register('isActive', {
                setValueAs: (v) => v === 'true' || v === true,
              })}
              id="branch-status"
              label="Operational Status"
              disabled={isSaving}
            >
              <option value="true">Active Office</option>
              <option value="false">Inactive / Closed</option>
            </Select>
          </div>
        </form>
      </Sheet>

      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Branch Changes?"
        description="Closing this form will lose unsubmitted branch details."
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

export function BranchFormSheet({ isOpen, onClose, branchToEdit }: BranchFormSheetProps) {
  if (!isOpen) return null
  return <BranchFormSheetInner onClose={onClose} branchToEdit={branchToEdit} />
}

