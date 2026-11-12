import { useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { TaskDetailModal } from '@/features/tasks/components/TaskDetailModal'
import { TaskDetailWorkspace } from '@/features/tasks/components/TaskDetailWorkspace'
import { getTaskDetailReturnTarget } from '@/features/tasks/utils/taskNavigation'

export interface TaskDetailPageProps {
  isModal?: boolean
}

export function TaskDetailPage({ isModal = false }: TaskDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [hasSubDialogOpen, setHasSubDialogOpen] = useState(false)

  const handleClose = useCallback(() => {
    if (isModal) {
      navigate(getTaskDetailReturnTarget(location, '/dashboard'))
    } else {
      navigate('/dashboard')
    }
  }, [isModal, location, navigate])

  if (isModal) {
    return (
      <TaskDetailModal
        isOpen={true}
        onClose={handleClose}
        titleId="task-workspace-title"
        pauseDismiss={hasSubDialogOpen}
      >
        <TaskDetailWorkspace
          key={id}
          taskId={id || ''}
          isModal={true}
          onClose={handleClose}
          onSubDialogOpenChange={setHasSubDialogOpen}
        />
      </TaskDetailModal>
    )
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto bg-surface border border-border-subtle rounded-[12px] shadow-card">
      <TaskDetailWorkspace
        key={id}
        taskId={id || ''}
        isModal={false}
        onClose={handleClose}
      />
    </div>
  )
}
