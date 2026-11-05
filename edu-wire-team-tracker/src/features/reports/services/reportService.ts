import { apiClient } from '@/lib/api/apiClient'
import type {
  DailyReportResponse,
  ReportFilterParams,
  WeeklyReportResponse,
  WeeklyTeamPerformance,
} from '../types/report.types'
import { calculateCompletionRate } from '../utils/reportUtils'

export const reportService = {
  /**
   * Fetches daily pending report text from GET /api/v1/reports/daily
   */
  async getDailyReport(filters?: ReportFilterParams): Promise<DailyReportResponse> {
    const params: Record<string, string> = {}
    if (filters?.branch && filters.branch !== 'all') params.branch = filters.branch
    if (filters?.team && filters.team !== 'all') params.team = filters.team

    const response = await apiClient.get<
      string | DailyReportResponse | { data: unknown } | { text: string } | { reportText: string }
    >('/reports/daily', { params })

    const raw = response.data

    if (typeof raw === 'string') {
      return { reportText: raw }
    }

    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      const reportText =
        (obj.reportText as string) ||
        (obj.text as string) ||
        (obj.report as string) ||
        (typeof obj.data === 'string' ? obj.data : (obj.data as Record<string, unknown>)?.text as string) ||
        (typeof obj.data === 'string' ? obj.data : (obj.data as Record<string, unknown>)?.reportText as string) ||
        ''

      return {
        reportText: reportText || '',
        date: (obj.date as string) || (obj.reportingDate as string),
        branch: (obj.branch as string) || filters?.branch,
        team: (obj.team as string) || filters?.team,
      }
    }

    return { reportText: '' }
  },

  /**
   * Fetches weekly performance report data from GET /api/v1/reports/weekly
   */
  async getWeeklyReport(filters?: ReportFilterParams): Promise<WeeklyReportResponse> {
    const params: Record<string, string> = {}
    if (filters?.branch && filters.branch !== 'all') params.branch = filters.branch
    if (filters?.team && filters.team !== 'all') params.team = filters.team

    const response = await apiClient.get<
      WeeklyReportResponse | { data: WeeklyReportResponse } | { report: WeeklyReportResponse }
    >('/reports/weekly', { params })

    const raw = response.data as Record<string, unknown>
    const data = (raw?.data || raw?.report || raw) as Record<string, unknown>

    const teamsRaw = (data?.teams || data?.teamPerformance || data?.items || []) as WeeklyTeamPerformance[]
    const teams: WeeklyTeamPerformance[] = Array.isArray(teamsRaw)
      ? teamsRaw.map((t) => ({
          team: t.team || 'Unknown',
          branch: t.branch,
          completed: Number(t.completed ?? 0),
          pending: Number(t.pending ?? 0),
          total: Number(t.total ?? (Number(t.completed ?? 0) + Number(t.pending ?? 0))),
          completionRate:
            t.completionRate !== undefined
              ? Number(t.completionRate)
              : calculateCompletionRate(Number(t.completed ?? 0), Number(t.pending ?? 0)),
        }))
      : []

    // Totals
    const completed =
      data?.completed !== undefined
        ? Number(data.completed)
        : teams.reduce((acc, t) => acc + t.completed, 0)

    const pending =
      data?.pending !== undefined
        ? Number(data.pending)
        : teams.reduce((acc, t) => acc + t.pending, 0)

    const total = completed + pending
    const completionRate =
      data?.completionRate !== undefined
        ? Number(data.completionRate)
        : calculateCompletionRate(completed, pending)

    return {
      period: (data?.period as string) || (data?.reportingPeriod as string),
      completed,
      pending,
      total,
      completionRate,
      teams,
    }
  },
}

