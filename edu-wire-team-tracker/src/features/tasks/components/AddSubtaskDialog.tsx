import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Clock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils/cn'
import { addSubtaskSchema, type AddSubtaskFormValues } from '../schemas/taskSchemas'
import { useCreateSubtask } from '../hooks/useCreateSubtask'
import { useTeamMembers } from '../hooks/useMetadata'
import { getTodayDateStringKolkata, formatTimeAMPM } from '../utils/dateUtils'
import type { Task } from '../types/task.types'

export interface AddSubtaskDialogProps {
  isOpen: boolean
  onClose: () => void
  parentTask: Task
}

const TIME_PRESETS = [
  { label: '10:00 AM', time: '10:00' },
  { label: '1:00 PM', time: '13:00' },
  { label: '5:00 PM', time: '17:00' },
  { label: '7:00 PM', time: '19:00' },
]

export function AddSubtaskDialog({
  isOpen,
  onClose,
  parentTask,
}: AddSubtaskDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const createSubtaskMutation = useCreateSubtask(parentTask.id)

  const { data: teamMembers = [], isLoading: isLoadingMembers } = useTeamMembers(
    parentTask.teamId || parentTask.team,
  )

  const existingOwnerIds = (parentTask.subtasks || []).map((s) => s.ownerId || s.owner.toLowerCase())

  const defaultValues: AddSubtaskFormValues = {
    title: '',
    owner: '',
    responsibilityLabel: '',
    note: '',
    due: parentTask.due || getTodayDateStringKolkata(),
    deadlineTime: '',
    deadlineTimezone: 'Asia/Kolkata',
    reminderMinutesBefore: null,
    priority: parentTask.priority || 'normal',
    isRequired: true,
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddSubtaskFormValues>({
    resolver: zodResolver(addSubtaskSchema) as any,
    defaultValues,
    mode: 'onTouched',
  })

  const selectedDeadlineTime = useWatch({ control, name: 'deadlineTime' }) || ''
  const selectedReminder = useWatch({ control, name: 'reminderMinutesBefore' })

  const onSubmit = async (values: AddSubtaskFormValues) => {
    setSubmitError(null)

    // Check duplicate assignee
    const isDuplicate = existingOwnerIds.some(
      (existing) => existing === values.owner.toLowerCase(),
    )
    if (isDuplicate) {
      setSubmitError('An active subtask is already assigned to this employee under this parent task.')
      return
    }

    try {
      await createSubtaskMutation.mutateAsync({
        title: values.title,
        owner: values.owner,
        responsibilityLabel: values.responsibilityLabel || undefined,
        note: values.note || undefined,
        due: values.due,
        deadlineTime: values.deadlineTime || undefined,
        deadlineTimezone: 'Asia/Kolkata',
        reminderMinutesBefore: values.deadlineTime
          ? (values.reminderMinutesBefore ?? 30)
          : null,
        priority: values.priority,
        isRequired: values.isRequired,
      })
      reset()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Failed to add subtask. Please try again.')
      }
    }
  }

  const isSaving = isSubmitting || createSubtaskMutation.isPending

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Individual Subtask"
      description={`Add another individual responsibility under "${parentTask.title}".`}
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isSaving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSaving}
            onClick={handleSubmit(onSubmit)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Subtask
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {submitError && (
          <Alert variant="error" title="Failed to add subtask">
            {submitError}
          </Alert>
        )}

        {/* 1. Assign To & Responsibility */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="add-subtask-owner"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Assign To <span className="text-red-500">*</span>
            </label>
            {isLoadingMembers ? (
              <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 flex items-center gap-2">
                <Spinner size="sm" />
                <span>Loading team members...</span>
              </div>
            ) : (
              <Select
                {...register('owner')}
                id="add-subtask-owner"
                error={errors.owner?.message}
                disabled={isSaving}
              >
                <option value="">Select team member</option>
                {teamMembers.map((m) => {
                  const alreadyAssigned =
                    existingOwnerIds.includes(m.id.toLowerCase()) ||
                    existingOwnerIds.includes(m.name.toLowerCase())
                  return (
                    <option key={m.id} value={m.name || m.id} disabled={alreadyAssigned}>
                      {m.name} {alreadyAssigned ? '(Already assigned)' : ''}
                    </option>
                  )
                })}
              </Select>
            )}
          </div>

          <div>
            <Input
              {...register('responsibilityLabel')}
              id="add-subtask-role"
              label="Responsibility / Work Role"
              placeholder="e.g. Frontend Developer, QA Tester"
              error={errors.responsibilityLabel?.message}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* 2. Subtask Title */}
        <div>
          <Input
            {...register('title')}
            id="add-subtask-title"
            label="Subtask Title"
            placeholder="e.g. Build REST APIs & Authentication"
            required
            error={errors.title?.message}
            disabled={isSaving}
          />
        </div>

        {/* 3. Work Instructions */}
        <div>
          <Textarea
            {...register('note')}
            id="add-subtask-note"
            label="Work Instructions (Optional)"
            placeholder="Describe specific tasks, checklists, or reference links..."
            rows={2}
            error={errors.note?.message}
            disabled={isSaving}
          />
        </div>

        {/* 4. Due Date & Deadline Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              {...register('due')}
              id="add-subtask-due"
              type="date"
              label="Subtask Due Date"
              required
              error={errors.due?.message}
              disabled={isSaving}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="add-subtask-time"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Deadline Time <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              {selectedDeadlineTime && (
                <span className="text-[11px] font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAMPM(selectedDeadlineTime)} IST</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                id="add-subtask-time"
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
                disabled={isSaving}
                className="h-10 px-3 bg-surface border border-border-subtle rounded-lg text-sm text-text-primary focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 flex-1"
              />
              {selectedDeadlineTime && (
                <button
                  type="button"
                  onClick={() => {
                    setValue('deadlineTime', '', { shouldValidate: true, shouldDirty: true })
                    setValue('reminderMinutesBefore', null, { shouldValidate: true, shouldDirty: true })
                  }}
                  className="h-10 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400">Presets:</span>
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.time}
                  type="button"
                  onClick={() => {
                    setValue('deadlineTime', preset.time, { shouldValidate: true, shouldDirty: true })
                    if (!selectedReminder) {
                      setValue('reminderMinutesBefore', 30, { shouldValidate: true, shouldDirty: true })
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

            {errors.deadlineTime?.message && (
              <p className="mt-1 text-xs text-red-500">{errors.deadlineTime.message}</p>
            )}
          </div>
        </div>

        {/* 5. Reminder, Priority & Required Checkbox */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-1">
          <div>
            <label
              htmlFor="add-subtask-reminder"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Advance Reminder
            </label>
            <Select
              {...register('reminderMinutesBefore')}
              id="add-subtask-reminder"
              disabled={isSaving || !selectedDeadlineTime}
            >
              <option value="30">30 mins before (Default)</option>
              <option value="60">60 mins before</option>
              <option value="">No reminder</option>
            </Select>
          </div>

          <div>
            <Select
              {...register('priority')}
              id="add-subtask-priority"
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
                {...register('isRequired')}
                className="rounded text-brand-blue focus:ring-brand-blue"
                disabled={isSaving}
              />
              <span>Required for parent completion</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}
