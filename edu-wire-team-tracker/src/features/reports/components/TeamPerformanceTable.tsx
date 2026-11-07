import type { WeeklyTeamPerformance } from '../types/report.types'

export interface TeamPerformanceTableProps {
  teams: WeeklyTeamPerformance[]
}

export function TeamPerformanceTable({ teams }: TeamPerformanceTableProps) {
  if (teams.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
        No team performance metrics recorded for this reporting period.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-card">
      <table className="w-full text-left text-xs text-text-muted border-collapse">
        <thead className="bg-slate-50/75 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none">
          <tr>
            <th className="px-5 py-3.5">Team</th>
            <th className="px-5 py-3.5">Branch</th>
            <th className="px-5 py-3.5 text-right">Completed</th>
            <th className="px-5 py-3.5 text-right">Pending</th>
            <th className="px-5 py-3.5 min-w-[200px]">Completed vs Pending</th>
            <th className="px-5 py-3.5 text-right">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/60">
          {teams.map((t, idx) => {
            const teamTotal = t.total ?? (t.completed + t.pending)
            const completedPct = teamTotal > 0 ? (t.completed / teamTotal) * 100 : 0
            const pendingPct = teamTotal > 0 ? (t.pending / teamTotal) * 100 : 0
            const rate = t.completionRate !== undefined ? t.completionRate : Math.round(completedPct)

            return (
              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                {/* Team Name */}
                <td className="px-5 py-4 font-semibold text-text-primary">
                  {t.team}
                </td>

                {/* Branch */}
                <td className="px-5 py-4 text-text-muted">
                  {t.branch || 'Headquarters / All'}
                </td>

                {/* Completed Count */}
                <td className="px-5 py-4 text-right font-semibold text-tint-green-text">
                  {t.completed}
                </td>

                {/* Pending Count */}
                <td className="px-5 py-4 text-right font-medium text-text-primary">
                  {t.pending}
                </td>

                {/* Visual Ratio Bar */}
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-[#15803D] transition-all duration-300"
                        style={{ width: `${completedPct}%` }}
                        title={`Completed: ${t.completed} (${Math.round(completedPct)}%)`}
                      />
                      <div
                        className="bg-brand-blue-light transition-all duration-300"
                        style={{ width: `${pendingPct}%` }}
                        title={`Pending: ${t.pending} (${Math.round(pendingPct)}%)`}
                      />
                    </div>
                  </div>
                </td>

                {/* Rate */}
                <td className="px-5 py-4 text-right font-bold text-text-primary">
                  {rate}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
