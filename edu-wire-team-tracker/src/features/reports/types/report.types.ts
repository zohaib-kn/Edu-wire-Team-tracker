export type ReportTab = 'daily' | 'weekly'

export interface ReportFilterParams {
  branch?: string
  team?: string
}

export interface DailyReportResponse {
  reportText: string
  date?: string
  branch?: string
  team?: string
}

export interface WeeklyTeamPerformance {
  team: string
  branch?: string
  completed: number
  pending: number
  total?: number
  completionRate?: number
}

export interface WeeklyReportResponse {
  period?: string
  completed: number
  pending: number
  total?: number
  completionRate?: number
  teams: WeeklyTeamPerformance[]
}

