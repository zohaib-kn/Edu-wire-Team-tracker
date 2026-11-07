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
      <div className="rounded-card border border-dashed border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
        No teams registered under the current filter selection.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-card">
      <table className="w-full text-left text-xs text-text-muted border-collapse">
        <thead className="bg-slate-50/75 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none">
          <tr>
            <th className="px-5 py-3.5">Team Name</th>
            <th className="px-5 py-3.5">Branch</th>
            <th className="px-5 py-3.5">Team Lead</th>
            <th className="px-5 py-3.5">Status</th>
            {canManage && <th className="px-5 py-3.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/60">
          {teams.map((t) => {
            const isActive = t.status === 'active' || t.isActive !== false

            return (
              <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4 font-semibold text-text-primary">
                  {t.name}
                </td>
                <td className="px-5 py-4 text-text-muted">
                  {t.branch || 'Headquarters / All'}
                </td>
                <td className="px-5 py-4 text-text-primary">
                  {t.leadName || t.lead || <span className="text-text-muted/50 italic">Unassigned</span>}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(t)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5 text-text-muted" />}
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
