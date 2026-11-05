import { useSearchParams } from 'react-router-dom'
import { FileText, BarChart3, RefreshCw, Clock } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { ReportsFilterBar } from '@/features/reports/components/ReportsFilterBar'
import { DailyPendingReport } from '@/features/reports/components/DailyPendingReport'
import { WeeklyPerformanceReport } from '@/features/reports/components/WeeklyPerformanceReport'
import { useDailyReport } from '@/features/reports/hooks/useDailyReport'
import { useWeeklyReport } from '@/features/reports/hooks/useWeeklyReport'
import { getCurrentReportingDateContext } from '@/features/reports/utils/reportUtils'
import type { ReportTab, ReportFilterParams } from '@/features/reports/types/report.types'
import { cn } from '@/lib/utils/cn'

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const currentTab = (searchParams.get('tab') as ReportTab) || 'daily'
  const branchFilter = searchParams.get('branch') || undefined
  const teamFilter = searchParams.get('team') || undefined

  const filters: ReportFilterParams = {
    branch: branchFilter,
    team: teamFilter,
  }

  // TanStack Query hooks for reports
  const {
    data: dailyData,
    isLoading: isDailyLoading,
    isError: isDailyError,
    refetch: refetchDaily,
    isFetching: isDailyFetching,
  } = useDailyReport(filters)

  const {
    data: weeklyData,
    isLoading: isWeeklyLoading,
    isError: isWeeklyError,
    refetch: refetchWeekly,
    isFetching: isWeeklyFetching,
  } = useWeeklyReport(filters)

  const isFetching = currentTab === 'daily' ? isDailyFetching : isWeeklyFetching

  const handleTabChange = (tab: ReportTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  const handleFilterChange = (newFilters: ReportFilterParams) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newFilters.branch && newFilters.branch !== 'all') {
        next.set('branch', newFilters.branch)
      } else {
        next.delete('branch')
      }

      if (newFilters.team && newFilters.team !== 'all') {
        next.set('team', newFilters.team)
      } else {
        next.delete('team')
      }
      return next
    })
  }

  const handleRefresh = () => {
    if (currentTab === 'daily') {
      refetchDaily()
    } else {
      refetchWeekly()
    }
  }

  const dateContext = getCurrentReportingDateContext()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reports"
        description="Monitor daily pending work and weekly team performance."
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{dateContext}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isFetching}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Date context on mobile */}
      <div className="sm:hidden flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>{dateContext}</span>
      </div>

      {/* Report Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('daily')}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer select-none',
            currentTab === 'daily'
              ? 'bg-[#1D4ED8] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Daily Pending Report</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('weekly')}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer select-none',
            currentTab === 'weekly'
              ? 'bg-[#1D4ED8] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Weekly Performance Report</span>
        </button>
      </div>

      {/* Permission-aware Filter Bar */}
      <ReportsFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Active Tab Content */}
      <div className="pt-1">
        {currentTab === 'daily' ? (
          <DailyPendingReport
            report={dailyData}
            isLoading={isDailyLoading}
            isError={isDailyError}
            onRetry={refetchDaily}
          />
        ) : (
          <WeeklyPerformanceReport
            report={weeklyData}
            isLoading={isWeeklyLoading}
            isError={isWeeklyError}
            onRetry={refetchWeekly}
          />
        )}
      </div>
    </div>
  )
}

