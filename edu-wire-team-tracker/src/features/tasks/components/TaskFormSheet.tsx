import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { createTaskSchema, type CreateTaskFormValues } from '../schemas/taskSchemas'
import { useCreateTask } from '../hooks/useCreateTask'
import { useUpdateTask } from '../hooks/useUpdateTask'
import { useTeams, useTeamMembers } from '../hooks/useMetadata'
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: teams = [] } = useTeams()

  const defaultValues: CreateTaskFormValues = {
    title: taskToEdit?.title || '',
    team: taskToEdit?.team || user?.teamId || (teams[0]?.id || ''),
    owner: taskToEdit?.owner || user?.name || user?.email || '',
    due: taskToEdit?.due
      ? taskToEdit.due.includes('T')
        ? taskToEdit.due.split('T')[0]
        : taskToEdit.due
      : getTodayDateStringKolkata(),
    priority: taskToEdit?.priority || 'normal',
    note: taskToEdit?.note || '',
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues,
    mode: 'onTouched',
  })

  // Watch selected team to load and filter members
  const selectedTeam = useWatch({ control, name: 'team' }) || ''
  const { data: teamMembers = [] } = useTeamMembers(selectedTeam)

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
    try {
      if (isEditing && taskToEdit) {
        // Edit only modifies allowed fields: title, note, owner, due, priority
        await updateTaskMutation.mutateAsync({
          title: values.title,
          note: values.note,
          owner: values.owner,
          due: values.due,
          priority: values.priority,
        })
      } else {
        await createTaskMutation.mutateAsync({
          title: values.title,
          team: values.team,
          owner: values.owner,
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
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {submitError && (
            <Alert variant="error" title="Submission Failed">
              {submitError}
            </Alert>
          )}

          {/* Task Title */}
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

          {/* Team Dropdown (locked if editing) */}
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
                disabled={isSaving}
              >
                <option value="">Select a team</option>
                {teams.length > 0 ? (
                  teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Operations">Operations</option>
                    <option value="Admissions">Admissions</option>
                    <option value="Counseling">Counseling</option>
                    <option value="Management">Management</option>
                  </>
                )}
              </Select>
            )}
          </div>

          {/* Assigned Owner Dropdown */}
          <div>
            {teamMembers.length > 0 ? (
              <Select
                {...register('owner')}
                id="owner"
                label="Assigned Owner"
                required
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
                label="Assigned Owner"
                placeholder="Enter owner name or email"
                required
                helperText={
                  teams.length === 0
                    ? 'Type owner name (team members will populate once the backend is linked).'
                    : undefined
                }
                error={errors.owner?.message}
                disabled={isSaving}
              />
            )}
          </div>

          {/* Two-column layout: Due Date & Priority */}
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

          {/* Note / Description */}
          <div>
            <Textarea
              {...register('note')}
              id="note"
              label="Notes / Instructions (Optional)"
              placeholder="Add relevant context, checklist items, or links..."
              rows={4}
              error={errors.note?.message}
              disabled={isSaving}
            />
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
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDiscard}
            >
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
