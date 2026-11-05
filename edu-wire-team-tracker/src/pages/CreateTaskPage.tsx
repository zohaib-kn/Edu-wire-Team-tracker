import { useNavigate } from 'react-router-dom'
import { TaskFormSheet } from '@/features/tasks/components/TaskFormSheet'

export function CreateTaskPage() {
  const navigate = useNavigate()

  return (
    <TaskFormSheet
      isOpen={true}
      onClose={() => navigate(-1)}
    />
  )
}

