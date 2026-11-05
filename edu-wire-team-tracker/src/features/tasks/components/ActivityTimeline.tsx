import { PlusCircle, Edit3, ArrowRightCircle, Trash2, Clock } from 'lucide-react'
import type { TaskActivity } from '../types/task.types'

export interface ActivityTimelineProps {
  activities?: TaskActivity[]
}

export function ActivityTimeline({ activities = [] }: ActivityTimelineProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
        No activity history recorded for this task yet.
      </div>
    )
  }

  const getActionConfig = (action: string) => {
    switch (action) {
      case 'created':
        return {
          label: 'Task created',
          icon: PlusCircle,
          colorClass: 'text-blue-600 bg-blue-50 border-blue-200',
        }
      case 'edited':
        return {
          label: 'Task updated',
          icon: Edit3,
          colorClass: 'text-amber-600 bg-amber-50 border-amber-200',
        }
      case 'status_changed':
        return {
          label: 'Status changed',
          icon: ArrowRightCircle,
          colorClass: 'text-purple-600 bg-purple-50 border-purple-200',
        }
      case 'deleted':
        return {
          label: 'Task deleted',
          icon: Trash2,
          colorClass: 'text-red-600 bg-red-50 border-red-200',
        }
      default:
        return {
          label: action,
          icon: Clock,
          colorClass: 'text-slate-600 bg-slate-50 border-slate-200',
        }
    }
  }

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts)
      if (isNaN(date.getTime())) return ts
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    } catch {
      return ts
    }
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {activities.map((item, idx) => {
        const config = getActionConfig(item.action)
        const Icon = config.icon

        return (
          <div key={item.id || idx} className="relative flex items-start gap-3 text-xs">
            {/* Timeline node icon */}
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${config.colorClass}`}
            >
              <Icon className="w-3 h-3" />
            </div>

            <div className="flex-1 bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-[#0F172A]">
                  {config.label}
                </span>
                <span className="text-[11px] text-slate-400">
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>

              <p className="text-slate-600">
                by <span className="font-medium text-slate-900">{item.user || 'Unknown'}</span>
                {item.details && ` • ${item.details}`}
              </p>

              {/* Field Changes */}
              {item.fieldChanges && item.fieldChanges.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                  {item.fieldChanges.map((change, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-1.5 text-slate-500">
                      <span className="font-medium capitalize text-slate-700">
                        {change.field}:
                      </span>
                      <span className="line-through text-slate-400">
                        {String(change.oldValue ?? '')}
                      </span>
                      <span>&rarr;</span>
                      <span className="font-medium text-[#0F172A]">
                        {String(change.newValue ?? '')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

