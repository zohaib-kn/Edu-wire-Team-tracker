import { PlusCircle, Edit3, ArrowRightCircle, Trash2, Clock } from 'lucide-react'
import type { TaskActivity } from '../types/task.types'

export interface ActivityTimelineProps {
  activities?: TaskActivity[]
}

export function ActivityTimeline({ activities = [] }: ActivityTimelineProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="py-5 px-4 flex items-center justify-center gap-2 text-center text-xs text-text-muted border border-dashed border-border-subtle bg-slate-50/50 rounded-[10px]">
        <Clock className="w-4 h-4 text-text-muted shrink-0" />
        <span>No activity available.</span>
      </div>
    )
  }

  const getActionConfig = (action: string) => {
    switch (action) {
      case 'created':
        return {
          label: 'Task created',
          icon: PlusCircle,
          colorClass: 'text-brand-blue bg-tint-blue-bg border-tint-blue-border',
        }
      case 'edited':
        return {
          label: 'Task updated',
          icon: Edit3,
          colorClass: 'text-tint-amber-text bg-tint-amber-bg border-tint-amber-border',
        }
      case 'status_changed':
        return {
          label: 'Status changed',
          icon: ArrowRightCircle,
          colorClass: 'text-brand-blue bg-tint-blue-bg border-tint-blue-border',
        }
      case 'deleted':
        return {
          label: 'Task deleted',
          icon: Trash2,
          colorClass: 'text-destructive bg-tint-red-bg border-tint-red-border',
        }
      default:
        return {
          label: action,
          icon: Clock,
          colorClass: 'text-text-muted bg-slate-50 border-border-subtle',
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
    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
      {activities.map((item, idx) => {
        const config = getActionConfig(item.action)
        const Icon = config.icon

        return (
          <div key={item.id || idx} className="relative flex items-start gap-3 text-xs">
            {/* Timeline node icon */}
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 shadow-xs ${config.colorClass}`}
            >
              <Icon className="w-3 h-3" />
            </div>

            <div className="flex-1 bg-surface border border-border-subtle rounded-[10px] p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-text-primary">
                  {config.label}
                </span>
                <span className="text-[11px] text-text-muted">
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>

              <p className="text-text-muted">
                by <span className="font-medium text-text-primary">{item.user || 'Unknown'}</span>
                {item.details && ` • ${item.details}`}
              </p>

              {/* Field Changes */}
              {item.fieldChanges && item.fieldChanges.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-subtle/50 space-y-1 text-[11px]">
                  {item.fieldChanges.map((change, cIdx) => (
                    <div key={cIdx} className="flex items-center gap-1.5 text-text-muted">
                      <span className="font-medium capitalize text-text-primary">
                        {change.field}:
                      </span>
                      <span className="line-through text-text-muted">
                        {String(change.oldValue ?? '')}
                      </span>
                      <span>&rarr;</span>
                      <span className="font-semibold text-text-primary">
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
