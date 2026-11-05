import { Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { TeamItem } from '../types/organization.types'

export interface TeamsTableProps {
  teams: TeamItem[]
  onEdit: (team: TeamItem) => void
  canManage: boolean
}

export function TeamsTable({
  teams,
  onEdit,
  canManage,
}: TeamsTableProps) {
  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center text-xs text-slate-400">
        No teams registered under the current filter selection.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
      <table className="w-full text-left text-xs text-slate-600 border-collapse">
        <thead className="bg-slate-50/75 border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
          <tr>
            <th className="px-4 py-3">Team Name</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Team Lead</th>
            <th className="px-4 py-3">Status</th>
            {canManage && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {teams.map((t) => {
            const isActive = t.status === 'active' || t.isActive !== false

            return (
              <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3.5 font-semibold text-slate-900">
                  {t.name}
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {t.branch || 'Headquarters / All'}
                </td>
                <td className="px-4 py-3.5 text-slate-800">
                  {t.leadName || t.lead || <span className="text-slate-400 italic">Unassigned</span>}
                </td>
                <td className="px-4 py-3.5">
                  <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(t)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5 text-slate-400" />}
                    >
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

