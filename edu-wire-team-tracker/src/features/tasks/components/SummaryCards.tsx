import { AlertTriangle, Calendar, Clock, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
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
      title: 'Late',
      description: 'Overdue incomplete tasks',
      count: summary?.late ?? 0,
      icon: AlertTriangle,
      colorClass: 'text-[#DC2626]',
      bgClass: 'bg-red-50 text-[#DC2626] border-red-100',
      borderClass: 'border-l-4 border-l-[#DC2626]',
    },
    {
      id: 'today',
      title: 'Today',
      description: 'Incomplete tasks due today',
      count: summary?.today ?? 0,
      icon: Calendar,
      colorClass: 'text-[#1D4ED8]',
      bgClass: 'bg-blue-50 text-[#1D4ED8] border-blue-100',
      borderClass: 'border-l-4 border-l-[#1D4ED8]',
    },
    {
      id: 'pending',
      title: 'Pending',
      description: 'Total active tasks to do',
      count: summary?.pending ?? 0,
      icon: Clock,
      colorClass: 'text-slate-700',
      bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
      borderClass: 'border-l-4 border-l-slate-400',
    },
    {
      id: 'done7Days',
      title: 'Done (7 days)',
      description: 'Completed in the last 7 days',
      count: summary?.done7Days ?? 0,
      icon: CheckCircle2,
      colorClass: 'text-[#16A34A]',
      bgClass: 'bg-green-50 text-[#16A34A] border-green-100',
      borderClass: 'border-l-4 border-l-[#16A34A]',
    },
  ]

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-4 text-xs text-red-700">
        Summary metrics are currently unavailable from the server.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.id}
            className={`shadow-xs transition-shadow hover:shadow-sm ${card.borderClass}`}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-medium text-slate-600">
                  {card.title}
                </span>
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border ${card.bgClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                {isLoading ? (
                  <div className="py-1">
                    <Spinner size="sm" className="text-slate-400" />
                  </div>
                ) : (
                  <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${card.colorClass}`}>
                    {card.count}
                  </span>
                )}
              </div>

              <p className="mt-1 text-[11px] text-slate-400 truncate">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

