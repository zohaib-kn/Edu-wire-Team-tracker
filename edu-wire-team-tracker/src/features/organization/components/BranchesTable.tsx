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
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center text-xs text-slate-400">
        No branches registered in the system yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
      <table className="w-full text-left text-xs text-slate-600 border-collapse">
        <thead className="bg-slate-50/75 border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
          <tr>
            <th className="px-4 py-3">Branch Name</th>
            <th className="px-4 py-3">City</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Teams</th>
            {canManage && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {branches.map((b) => {
            const isActive = b.status === 'active' || b.isActive !== false

            return (
              <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3.5 font-semibold text-slate-900">
                  {b.name}
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {b.city}
                </td>
                <td className="px-4 py-3.5">
                  <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {b.teamCount !== undefined ? `${b.teamCount} teams` : '—'}
                </td>
                {canManage && (
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(b)}
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

