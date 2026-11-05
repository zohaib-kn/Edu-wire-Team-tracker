import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useDeleteTask } from '../hooks/useDeleteTask'
import type { Task } from '../types/task.types'

export interface TaskDeleteDialogProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function TaskDeleteDialog({
  task,
  isOpen,
  onClose,
  onSuccess,
}: TaskDeleteDialogProps) {
  const deleteMutation = useDeleteTask()

  if (!task) return null

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(task.id)
      onClose()
      if (onSuccess) onSuccess()
    } catch {
      // Error toast is already triggered by useDeleteTask
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Task"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            Yes, Delete Task
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 text-[#DC2626] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-[#0F172A] mb-1">
            Are you sure you want to delete this task?
          </p>
          <p className="text-slate-500 mb-2">
            &ldquo;{task.title}&rdquo; will be soft-deleted and removed from the active board.
          </p>
          <p className="text-xs text-slate-400">
            This action can only be authorized by administrators.
          </p>
        </div>
      </div>
    </Modal>
  )
}

