import { Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { BranchItem } from '../types/organization.types'

export interface BranchesTableProps {
  branches: BranchItem[]
  onEdit: (branch: BranchItem) => void
  canManage: boolean
}

export function BranchesTable({
  branches,
  onEdit,
  canManage,
}: BranchesTableProps) {
  if (branches.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
        No branches registered in the system yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-card">
      <table className="w-full text-left text-xs text-text-muted border-collapse">
        <thead className="bg-slate-50/75 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none">
          <tr>
            <th className="px-5 py-3.5">Branch Name</th>
            <th className="px-5 py-3.5">City</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5">Teams</th>
            {canManage && <th className="px-5 py-3.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/60">
          {branches.map((b) => {
            const isActive = b.status === 'active' || b.isActive !== false

            return (
              <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4 font-semibold text-text-primary">
                  {b.name}
                </td>
                <td className="px-5 py-4 text-text-muted">
                  {b.city}
                </td>
                <td className="px-5 py-4">
                  <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-text-muted">
                  {b.teamCount !== undefined ? `${b.teamCount} teams` : '—'}
                </td>
                {canManage && (
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(b)}
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
