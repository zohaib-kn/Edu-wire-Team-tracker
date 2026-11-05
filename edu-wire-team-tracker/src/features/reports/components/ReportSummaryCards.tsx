import { CheckCircle2, Clock, Percent, CalendarRange } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'

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
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
          <span>Reporting Period: <strong className="text-slate-800">{period}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Completed Tasks Card */}
        <Card className="shadow-xs border-l-4 border-l-[#16A34A] transition-shadow hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-medium text-slate-600">
                Completed Tasks
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-50 text-[#16A34A] border border-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#16A34A]">
                {completed}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Tasks finished in this reporting cycle
            </p>
          </CardContent>
        </Card>

        {/* Pending Tasks Card */}
        <Card className="shadow-xs border-l-4 border-l-slate-400 transition-shadow hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-medium text-slate-600">
                Pending Tasks
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">
                {pending}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Active tasks in progress or to do
            </p>
          </CardContent>
        </Card>

        {/* Completion Rate Card */}
        <Card className="shadow-xs border-l-4 border-l-[#1D4ED8] transition-shadow hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-medium text-slate-600">
                Completion Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-100 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D4ED8]">
                {rate}%
              </span>
              <span className="text-xs text-slate-400">
                of {calculatedTotal} total
              </span>
            </div>

            {/* Subtle Progress Bar */}
            <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

