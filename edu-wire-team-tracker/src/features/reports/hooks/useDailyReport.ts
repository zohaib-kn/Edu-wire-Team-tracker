import { useQuery } from '@tanstack/react-query'
import { reportService } from '../services/reportService'
import { reportKeys } from './reportQueryKeys'
import type { DailyReportResponse, ReportFilterParams } from '../types/report.types'

export function useDailyReport(filters?: ReportFilterParams) {
  return useQuery<DailyReportResponse>({
    queryKey: reportKeys.daily((filters || {}) as Record<string, unknown>),
    queryFn: () => reportService.getDailyReport(filters),
  })
}

