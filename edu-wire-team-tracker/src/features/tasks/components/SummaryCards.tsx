import { Calendar, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import type { TaskSummary } from '../types/task.types'

export interface SummaryCardsProps {
  summary?: TaskSummary
  isLoading?: boolean
  isError?: boolean
}

export function SummaryCards({
  summary,
  isLoading = false,
  isError = false,
}: SummaryCardsProps) {
  const cards = [
    {
      id: 'late',
      title: 'Late Tasks',
      description: 'Overdue incomplete tasks',
      count: summary?.late ?? 0,
      icon: AlertTriangle,
      tint: {
        cardBorder: 'border-tint-red-border/70',
        iconBg: 'bg-tint-red-bg border-tint-red-border text-tint-red-text',
        countColor: 'text-tint-red-text',
      },
    },
    {
      id: 'today',
      title: 'Due Today',
      description: 'Tasks due today',
      count: summary?.today ?? 0,
      icon: Calendar,
      tint: {
        cardBorder: 'border-tint-blue-border/70',
        iconBg: 'bg-tint-blue-bg border-tint-blue-border text-tint-blue-text',
        countColor: 'text-tint-blue-text',
      },
    },
    {
      id: 'pending',
      title: 'Pending',
      description: 'Total active tasks',
      count: summary?.pending ?? 0,
      icon: Clock,
      tint: {
        cardBorder: 'border-tint-amber-border/70',
        iconBg: 'bg-tint-amber-bg border-tint-amber-border text-tint-amber-text',
        countColor: 'text-tint-amber-text',
      },
    },
    {
      id: 'done7Days',
      title: 'Completed (7 days)',
      description: 'Tasks completed in last 7 days',
      count: summary?.done7Days ?? 0,
      icon: CheckCircle2,
      tint: {
        cardBorder: 'border-tint-green-border/70',
        iconBg: 'bg-tint-green-bg border-tint-green-border text-tint-green-text',
        countColor: 'text-tint-green-text',
      },
    },
  ]

  if (isError) {
    return (
      <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-4 text-xs text-tint-red-text">
        Summary metrics are currently unavailable from the server.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.id}
            className={`rounded-card bg-surface border ${card.tint.cardBorder} p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4`}
          >
            {/* Left: Icon Tile */}
            <div
              className={`w-12 h-12 rounded-inner flex items-center justify-center border shrink-0 ${card.tint.iconBg}`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.75} />
            </div>

            {/* Right: Label, Metric Count & Caption */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-text-muted truncate">
                {card.title}
              </span>

              <div className="mt-0.5 flex items-baseline">
                {isLoading ? (
                  <div className="py-1">
                    <Spinner size="sm" className="text-text-muted" />
                  </div>
                ) : (
                  <span
                    className={`text-3xl font-bold tracking-tight ${card.tint.countColor}`}
                  >
                    {card.count}
                  </span>
                )}
              </div>

              <span className="text-[11px] text-text-muted/80 truncate mt-0.5">
                {card.description}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
