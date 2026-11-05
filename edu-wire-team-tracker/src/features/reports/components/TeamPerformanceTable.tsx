import type { WeeklyTeamPerformance } from '../types/report.types'

export interface TeamPerformanceTableProps {
  teams: WeeklyTeamPerformance[]
}

export function TeamPerformanceTable({ teams }: TeamPerformanceTableProps) {
  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center text-xs text-slate-400">
        No team performance metrics recorded for this reporting period.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
      <table className="w-full text-left text-xs text-slate-600 border-collapse">
        <thead className="bg-slate-50/75 border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
          <tr>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3 text-right">Completed</th>
            <th className="px-4 py-3 text-right">Pending</th>
            <th className="px-4 py-3 min-w-[200px]">Completed vs Pending</th>
            <th className="px-4 py-3 text-right">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {teams.map((t, idx) => {
            const teamTotal = t.total ?? (t.completed + t.pending)
            const completedPct = teamTotal > 0 ? (t.completed / teamTotal) * 100 : 0
            const pendingPct = teamTotal > 0 ? (t.pending / teamTotal) * 100 : 0
            const rate = t.completionRate !== undefined ? t.completionRate : Math.round(completedPct)

            return (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                {/* Team Name */}
                <td className="px-4 py-3.5 font-semibold text-slate-900">
                  {t.team}
                </td>

                {/* Branch */}
                <td className="px-4 py-3.5 text-slate-600">
                  {t.branch || 'Headquarters / All'}
                </td>

                {/* Completed Count */}
                <td className="px-4 py-3.5 text-right font-medium text-[#16A34A]">
                  {t.completed}
                </td>

                {/* Pending Count */}
                <td className="px-4 py-3.5 text-right font-medium text-slate-800">
                  {t.pending}
                </td>

                {/* Visual Ratio Bar */}
                <td className="px-4 py-3.5">
                  <div className="space-y-1">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-[#16A34A] transition-all duration-300"
                        style={{ width: `${completedPct}%` }}
                        title={`Completed: ${t.completed} (${Math.round(completedPct)}%)`}
                      />
                      <div
                        className="bg-blue-300 transition-all duration-300"
                        style={{ width: `${pendingPct}%` }}
                        title={`Pending: ${t.pending} (${Math.round(pendingPct)}%)`}
                      />
                    </div>
                  </div>
                </td>

                {/* Rate */}
                <td className="px-4 py-3.5 text-right font-semibold text-[#0F172A]">
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

