import { PERMISSIONS } from '@/lib/permissions/permissions'
import { cn } from '@/lib/utils/cn'
import type { PermissionKey } from '@/features/auth/types/auth.types'
import type { MatrixScope, RolePermissionConfig } from '../types/role.types'

export interface RolePermissionMatrixProps {
  permissions: RolePermissionConfig[]
  onChange: (permissions: RolePermissionConfig[]) => void
  disabled?: boolean
}

interface MatrixPermissionItem {
  key: PermissionKey
  label: string
  description: string
  category: 'Tasks' | 'Analytics' | 'Administration'
  allowedScopes: MatrixScope[]
}

const MATRIX_PERMISSIONS_CATALOG: MatrixPermissionItem[] = [
  {
    key: PERMISSIONS.TASK_VIEW,
    label: 'View Tasks',
    description: 'Inspect task records and progress across authorized scopes',
    category: 'Tasks',
    allowedScopes: ['none', 'own', 'team', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.TASK_CREATE,
    label: 'Create Tasks',
    description: 'Create new tasks and delegate assignments to team members',
    category: 'Tasks',
    allowedScopes: ['none', 'own', 'team', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.TASK_EDIT,
    label: 'Edit Tasks',
    description: 'Modify task details, assigned owner, due date, and priority',
    category: 'Tasks',
    allowedScopes: ['none', 'own', 'team', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.TASK_STATUS,
    label: 'Change Task Status',
    description: 'Update task lifecycle status (To Do, In Progress, Done)',
    category: 'Tasks',
    allowedScopes: ['none', 'own', 'team', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.TASK_DELETE,
    label: 'Delete Tasks',
    description: 'Soft-delete tasks from boards (Restricted from members/leads)',
    category: 'Tasks',
    allowedScopes: ['none', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.REPORT_VIEW,
    label: 'View Reports',
    description: 'Access branch productivity analytics and task turnaround reports',
    category: 'Analytics',
    allowedScopes: ['none', 'team', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.USER_MANAGE,
    label: 'Manage Users',
    description: 'Provision staff accounts, assign roles, and trigger password resets',
    category: 'Administration',
    allowedScopes: ['none', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.TEAM_MANAGE,
    label: 'Manage Teams',
    description: 'Create functional desks and appoint team leads',
    category: 'Administration',
    allowedScopes: ['none', 'branch', 'all'],
  },
  {
    key: PERMISSIONS.BRANCH_MANAGE,
    label: 'Manage Branches',
    description: 'Register physical branch centers and operational office cities',
    category: 'Administration',
    allowedScopes: ['none', 'all'],
  },
  {
    key: PERMISSIONS.ROLE_MANAGE,
    label: 'Manage Roles',
    description: 'Configure security scopes and access control matrices',
    category: 'Administration',
    allowedScopes: ['none', 'all'],
  },
]

const SCOPE_LABELS: Record<MatrixScope, { label: string; badgeClasses: string }> = {
  none: { label: 'None', badgeClasses: 'text-slate-400 bg-slate-50' },
  own: { label: 'Own', badgeClasses: 'text-slate-700 bg-slate-100 font-medium' },
  team: { label: 'Team', badgeClasses: 'text-blue-700 bg-blue-50 font-medium' },
  branch: { label: 'Branch', badgeClasses: 'text-amber-700 bg-amber-50 font-medium' },
  all: { label: 'All (Org)', badgeClasses: 'text-emerald-700 bg-emerald-50 font-semibold' },
}

export function RolePermissionMatrix({
  permissions,
  onChange,
  disabled = false,
}: RolePermissionMatrixProps) {
  const getSelectedScope = (permKey: PermissionKey): MatrixScope => {
    const found = permissions.find((p) => p.permission === permKey)
    return found ? found.scope : 'none'
  }

  const handleScopeChange = (permKey: PermissionKey, newScope: MatrixScope) => {
    if (disabled) return
    const existingIndex = permissions.findIndex((p) => p.permission === permKey)
    let next: RolePermissionConfig[]
    if (existingIndex >= 0) {
      next = [...permissions]
      next[existingIndex] = { permission: permKey, scope: newScope }
    } else {
      next = [...permissions, { permission: permKey, scope: newScope }]
    }
    onChange(next)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50/75 border-b border-[#E2E8F0] text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
          <tr>
            <th className="px-4 py-3 min-w-[200px]">Permission</th>
            <th className="px-4 py-3 min-w-[240px]">Description</th>
            <th className="px-4 py-3 text-right min-w-[220px]">Authorized Scope</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {MATRIX_PERMISSIONS_CATALOG.map((item) => {
            const currentScope = getSelectedScope(item.key)

            return (
              <tr key={item.key} className="hover:bg-slate-50/50 transition-colors">
                {/* Permission Name */}
                <td className="px-4 py-3 font-semibold text-slate-900">
                  <div className="flex items-center gap-2">
                    <span>{item.label}</span>
                    <span className="font-mono text-[10px] text-slate-400 font-normal">
                      ({item.key})
                    </span>
                  </div>
                </td>

                {/* Description */}
                <td className="px-4 py-3 text-slate-500 text-[11px] leading-relaxed">
                  {item.description}
                </td>

                {/* Scope Selection */}
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    {item.allowedScopes.map((scope) => {
                      const isSelected = currentScope === scope
                      const meta = SCOPE_LABELS[scope]

                      return (
                        <button
                          key={scope}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleScopeChange(item.key, scope)}
                          className={cn(
                            'px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer',
                            isSelected
                              ? 'bg-white shadow-xs font-semibold text-[#0F172A]'
                              : 'text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed',
                            disabled && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <span className={cn('px-1 py-0.5 rounded', isSelected && meta.badgeClasses)}>
                            {meta.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
