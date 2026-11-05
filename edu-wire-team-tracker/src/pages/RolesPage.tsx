import { useState, useMemo } from 'react'
import { Shield, ShieldAlert, Check, RefreshCw, Save, RotateCcw } from 'lucide-react'
import { useRolesList, useUpdateRole } from '@/features/roles/hooks/useRoles'
import { RolePermissionMatrix } from '@/features/roles/components/RolePermissionMatrix'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { PERMISSIONS } from '@/lib/permissions/permissions'
import { cn } from '@/lib/utils/cn'
import type { RoleItem, RolePermissionConfig } from '@/features/roles/types/role.types'

// Default system roles reference from the implementation plan
const DEFAULT_PLAN_ROLES: RoleItem[] = [
  {
    id: 'role-super-admin',
    name: 'Super Admin',
    description: 'Complete cross-branch administrative access and security control.',
    isSystem: true,
    permissions: [
      { permission: PERMISSIONS.TASK_VIEW, scope: 'all' },
      { permission: PERMISSIONS.TASK_CREATE, scope: 'all' },
      { permission: PERMISSIONS.TASK_EDIT, scope: 'all' },
      { permission: PERMISSIONS.TASK_STATUS, scope: 'all' },
      { permission: PERMISSIONS.TASK_DELETE, scope: 'all' },
      { permission: PERMISSIONS.REPORT_VIEW, scope: 'all' },
      { permission: PERMISSIONS.USER_MANAGE, scope: 'all' },
      { permission: PERMISSIONS.TEAM_MANAGE, scope: 'all' },
      { permission: PERMISSIONS.BRANCH_MANAGE, scope: 'all' },
      { permission: PERMISSIONS.ROLE_MANAGE, scope: 'all' },
    ],
  },
  {
    id: 'role-branch-admin',
    name: 'Branch Admin',
    description: 'Manages team assignments, staff, and tasks within their assigned branch.',
    isSystem: true,
    permissions: [
      { permission: PERMISSIONS.TASK_VIEW, scope: 'branch' },
      { permission: PERMISSIONS.TASK_CREATE, scope: 'branch' },
      { permission: PERMISSIONS.TASK_EDIT, scope: 'branch' },
      { permission: PERMISSIONS.TASK_STATUS, scope: 'branch' },
      { permission: PERMISSIONS.TASK_DELETE, scope: 'branch' },
      { permission: PERMISSIONS.REPORT_VIEW, scope: 'branch' },
      { permission: PERMISSIONS.USER_MANAGE, scope: 'branch' },
      { permission: PERMISSIONS.TEAM_MANAGE, scope: 'branch' },
      { permission: PERMISSIONS.BRANCH_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.ROLE_MANAGE, scope: 'none' },
    ],
  },
  {
    id: 'role-team-lead',
    name: 'Team Lead',
    description: 'Supervises tasks and performance within their functional team desk.',
    isSystem: true,
    permissions: [
      { permission: PERMISSIONS.TASK_VIEW, scope: 'team' },
      { permission: PERMISSIONS.TASK_CREATE, scope: 'team' },
      { permission: PERMISSIONS.TASK_EDIT, scope: 'team' },
      { permission: PERMISSIONS.TASK_STATUS, scope: 'team' },
      { permission: PERMISSIONS.TASK_DELETE, scope: 'none' },
      { permission: PERMISSIONS.REPORT_VIEW, scope: 'team' },
      { permission: PERMISSIONS.USER_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.TEAM_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.BRANCH_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.ROLE_MANAGE, scope: 'none' },
    ],
  },
  {
    id: 'role-member',
    name: 'Member',
    description: 'Executes personal assigned tasks with visibility over team tasks.',
    isSystem: true,
    permissions: [
      { permission: PERMISSIONS.TASK_VIEW, scope: 'team' },
      { permission: PERMISSIONS.TASK_CREATE, scope: 'own' },
      { permission: PERMISSIONS.TASK_EDIT, scope: 'own' },
      { permission: PERMISSIONS.TASK_STATUS, scope: 'own' },
      { permission: PERMISSIONS.TASK_DELETE, scope: 'none' },
      { permission: PERMISSIONS.REPORT_VIEW, scope: 'none' },
      { permission: PERMISSIONS.USER_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.TEAM_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.BRANCH_MANAGE, scope: 'none' },
      { permission: PERMISSIONS.ROLE_MANAGE, scope: 'none' },
    ],
  },
]

function RoleEditorPanel({ role }: { role: RoleItem }) {
  const [activePermissions, setActivePermissions] = useState<RolePermissionConfig[]>(
    role.permissions || [],
  )
  const [isDirty, setIsDirty] = useState(false)
  const updateRoleMutation = useUpdateRole(role.id)

  const handlePermissionsChange = (newPerms: RolePermissionConfig[]) => {
    setActivePermissions(newPerms)
    setIsDirty(true)
  }

  const handleReset = () => {
    setActivePermissions(role.permissions || [])
    setIsDirty(false)
  }

  const handleSave = async () => {
    try {
      await updateRoleMutation.mutateAsync({
        permissions: activePermissions,
      })
      setIsDirty(false)
    } catch {
      // Handled by toast in hook
    }
  }

  return (
    <div className="space-y-4">
      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You have modified permissions for <strong>{role.name}</strong>. Remember to click &ldquo;Save Changes&rdquo; to apply updates.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={handleReset} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={updateRoleMutation.isPending}
              onClick={handleSave}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Role Header Card */}
      <div className="flex items-center justify-between bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center shrink-0 border border-blue-100">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#0F172A]">{role.name}</h3>
              {role.isSystem && (
                <span className="text-[11px] text-slate-400 font-medium">
                  (Core System Role)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isDirty && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <Check className="w-4 h-4 text-green-600" />
              <span>Permission matrix synced</span>
            </div>
          )}
          {isDirty && (
            <Button
              variant="primary"
              size="sm"
              isLoading={updateRoleMutation.isPending}
              onClick={handleSave}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <RolePermissionMatrix
        permissions={activePermissions}
        onChange={handlePermissionsChange}
        disabled={updateRoleMutation.isPending}
      />
    </div>
  )
}

export function RolesPage() {
  const { data: apiRoles = [], isLoading, isError, refetch } = useRolesList()

  const roles: RoleItem[] = useMemo(() => {
    return apiRoles.length > 0 ? apiRoles : DEFAULT_PLAN_ROLES
  }, [apiRoles])

  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || '')

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Roles & Permissions"
        description="Fine-grained security scopes and access control matrix"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              aria-label="Refresh roles"
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Main Workspace Layout: Roles Selector (Left) + Matrix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Role Cards / List */}
        <div className="lg:col-span-1 space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Configured Roles
          </h4>

          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner size="md" className="text-[#1D4ED8]" />
            </div>
          ) : isError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              Failed to load roles from server. Showing plan baseline reference.
            </div>
          ) : (
            roles.map((role) => {
              const isSelected = role.id === selectedRole?.id

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    'w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer',
                    isSelected
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : 'bg-white border-[#E2E8F0] hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isSelected ? 'text-[#1D4ED8]' : 'text-slate-900',
                      )}
                    >
                      {role.name}
                    </span>
                    {role.isSystem && (
                      <Badge variant="neutral" size="sm" className="text-[10px] py-0 px-1.5">
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {role.description}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Right Column: Keyed Permission Matrix Editor */}
        <div className="lg:col-span-3">
          {selectedRole && (
            <RoleEditorPanel key={selectedRole.id} role={selectedRole} />
          )}
        </div>
      </div>
    </div>
  )
}
