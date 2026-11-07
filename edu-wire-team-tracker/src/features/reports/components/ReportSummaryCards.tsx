import { CheckCircle2, Clock, Percent, CalendarRange } from 'lucide-react'

export interface ReportSummaryCardsProps {
  completed: number
  pending: number
  total?: number
  completionRate?: number
  period?: string
}

export function ReportSummaryCards({
  completed,
  pending,
  total,
  completionRate,
  period,
}: ReportSummaryCardsProps) {
  const calculatedTotal = total ?? (completed + pending)
  const rate =
    completionRate !== undefined
      ? completionRate
      : calculatedTotal > 0
      ? Math.round((completed / calculatedTotal) * 100)
      : 0

  return (
    <div className="space-y-3">
      {period && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <CalendarRange className="w-3.5 h-3.5 text-text-muted/70" />
          <span>
            Reporting Period: <strong className="text-text-primary">{period}</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Completed Tasks Card */}
        <div className="rounded-card bg-surface border border-tint-green-border/70 p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-inner bg-tint-green-bg border border-tint-green-border text-tint-green-text flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-text-muted truncate">
              Completed Tasks
            </span>
            <span className="text-3xl font-bold tracking-tight text-tint-green-text mt-0.5">
              {completed}
            </span>
            <p className="mt-0.5 text-[11px] text-text-muted truncate">
              Tasks finished in this reporting cycle
            </p>
          </div>
        </div>

        {/* Pending Tasks Card */}
        <div className="rounded-card bg-surface border border-tint-amber-border/70 p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-inner bg-tint-amber-bg border border-tint-amber-border text-tint-amber-text flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-text-muted truncate">
              Pending Tasks
            </span>
            <span className="text-3xl font-bold tracking-tight text-tint-amber-text mt-0.5">
              {pending}
            </span>
            <p className="mt-0.5 text-[11px] text-text-muted truncate">
              Active tasks in progress or to do
            </p>
          </div>
        </div>

        {/* Completion Rate Card */}
        <div className="rounded-card bg-surface border border-tint-blue-border/70 p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-inner bg-tint-blue-bg border border-tint-blue-border text-tint-blue-text flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-text-muted truncate">
              Completion Rate
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-bold tracking-tight text-brand-blue">
                {rate}%
              </span>
              <span className="text-xs text-text-muted">
                of {calculatedTotal} total
              </span>
            </div>
            {/* Subtle Progress Bar */}
            <div className="mt-1.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#15803D] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
