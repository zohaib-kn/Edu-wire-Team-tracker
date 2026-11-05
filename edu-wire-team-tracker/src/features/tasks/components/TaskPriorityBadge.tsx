import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { TaskPriority } from '../types/task.types'

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === 'high') {
    return (
      <Badge
        variant="error"
        size="sm"
        className="gap-1 font-semibold text-[11px] bg-red-50 text-[#DC2626] border-red-200"
      >
        <AlertCircle className="w-3 h-3" />
        High
      </Badge>
    )
  }

  return (
    <Badge
      variant="neutral"
      size="sm"
      className="text-[11px] text-slate-500 bg-slate-50 border-slate-200"
    >
      Normal
    </Badge>
  )
}

