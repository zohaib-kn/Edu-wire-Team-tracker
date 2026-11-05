import { AlertCircle, RefreshCw, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ReportSummaryCards } from './ReportSummaryCards'
import { TeamPerformanceTable } from './TeamPerformanceTable'
import type { WeeklyReportResponse } from '../types/report.types'

export interface WeeklyPerformanceReportProps {
  report?: WeeklyReportResponse
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

export function WeeklyPerformanceReport({
  report,
  isLoading,
  isError,
  onRetry,
}: WeeklyPerformanceReportProps) {
  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Spinner size="lg" className="text-[#1D4ED8] mb-3" />
        <p className="text-sm font-medium">Calculating weekly team performance...</p>
      </div>
    )
  }

  if (isError || !report) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-800">
        <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto mb-2" />
        <p className="font-semibold mb-1">Failed to load weekly performance report</p>
        <p className="text-xs text-red-600 mb-4 max-w-md mx-auto">
          The weekly reporting service (<code>GET /api/v1/reports/weekly</code>) could not be reached or returned an error.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry Fetching Report
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metric Summary Cards */}
      <ReportSummaryCards
        completed={report.completed}
        pending={report.pending}
        total={report.total}
        completionRate={report.completionRate}
        period={report.period}
      />

      {/* Team Performance Breakdown Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#1D4ED8]" />
            <h3 className="text-sm font-semibold text-slate-800">
              Team Breakdown
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {report.teams?.length || 0} teams tracked
          </span>
        </div>

        <TeamPerformanceTable teams={report.teams || []} />
      </div>
    </div>
  )
}

