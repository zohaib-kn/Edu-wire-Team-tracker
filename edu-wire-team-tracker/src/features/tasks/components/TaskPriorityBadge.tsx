import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { TaskPriority } from '../types/task.types'

export function TaskPriorityBadge({
  priority,
}: {
  priority: TaskPriority | 'low' | string
}) {
  if (priority === 'high') {
    return (
      <Badge
        variant="error"
        size="sm"
        className="gap-1 font-semibold text-[11px]"
      >
        <AlertCircle className="w-3 h-3" />
        High
      </Badge>
    )
  }

  if (priority === 'low') {
    return (
      <Badge
        variant="success"
        size="sm"
        className="text-[11px] font-semibold"
      >
        Low
      </Badge>
    )
  }

  return (
    <Badge
      variant="warning"
      size="sm"
      className="text-[11px] font-semibold"
    >
      Normal
    </Badge>
  )
}
