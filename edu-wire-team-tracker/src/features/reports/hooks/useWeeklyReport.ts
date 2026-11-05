import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/reportService'
import { reportKeys } from './reportQueryKeys'
import type { ReportFilterParams, WeeklyReportResponse } from '../types/report.types'

export function useWeeklyReport(filters?: ReportFilterParams) {
  return useQuery<WeeklyReportResponse>({
    queryKey: reportKeys.weekly((filters || {}) as Record<string, unknown>),
    queryFn: () => reportService.getWeeklyReport(filters),
  })
}

