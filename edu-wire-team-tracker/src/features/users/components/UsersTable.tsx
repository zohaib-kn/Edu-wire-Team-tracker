import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Edit2, KeyRound, UserX, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDateOnly } from '@/features/tasks/utils/dateUtils'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { ManagedUser } from '../types/userAdmin.types'

export interface UsersTableProps {
  users: ManagedUser[]
  onEdit: (user: ManagedUser) => void
  onResetPassword: (user: ManagedUser) => void
  onToggleStatus: (user: ManagedUser) => void
}

function UserActionMenu({
  user,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: {
  user: ManagedUser
  onEdit: (user: ManagedUser) => void
  onResetPassword: (user: ManagedUser) => void
  onToggleStatus: (user: ManagedUser) => void
}) {
  const { user: currentAuthUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isSelf = currentAuthUser?.id === user.id
  const isBranchAdmin = currentAuthUser?.role === 'Branch Admin'
  const isTargetAdmin = user.role === 'Super Admin' || user.role === 'Branch Admin'

  // Branch Admin cannot edit/reset/deactivate Super Admin or another Branch Admin
  const canModify = !isBranchAdmin || !isTargetAdmin
  const isCurrentlyActive = user.status === 'active' || user.isActive === true

  if (!canModify && !isSelf) {
    return <span className="text-[11px] text-text-muted italic">Protected</span>
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Actions for ${user.name}`}
        className="p-1.5 rounded-badge text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-card bg-surface border border-border-subtle shadow-dropdown py-1.5 z-30 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {canModify && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onEdit(user)
              }}
              className="w-full flex items-center gap-2 px-3.5 py-1.5 text-left text-text-primary hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-text-muted" />
              <span>Edit Account</span>
            </button>
          )}

          {canModify && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onResetPassword(user)
              }}
              className="w-full flex items-center gap-2 px-3.5 py-1.5 text-left text-text-primary hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-text-muted" />
              <span>Reset Password</span>
            </button>
          )}

          {!isSelf && canModify && (
            <div className="border-t border-border-subtle/50 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onToggleStatus(user)
                }}
                className={`w-full flex items-center gap-2 px-3.5 py-1.5 text-left transition-colors cursor-pointer ${
                  isCurrentlyActive
                    ? 'text-destructive hover:bg-tint-red-bg'
                    : 'text-tint-green-text hover:bg-tint-green-bg'
                }`}
              >
                {isCurrentlyActive ? (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>Deactivate</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Reactivate</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function UsersTable({
  users,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
        No staff accounts match your current filter settings.
      </div>
    )
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'Super Admin':
        return 'primary'
      case 'Branch Admin':
        return 'warning'
      case 'Team Lead':
        return 'success'
      default:
        return 'neutral'
    }
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-card">
      <table className="w-full text-left text-xs text-text-muted border-collapse">
        <thead className="bg-slate-50/75 border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none">
          <tr>
            <th className="px-5 py-3.5">Staff Member</th>
            <th className="px-5 py-3.5">Role</th>
            <th className="px-5 py-3.5">Branch</th>
            <th className="px-5 py-3.5">Teams</th>
            <th className="px-5 py-3.5">Contact</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5">Last Login</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/60">
          {users.map((u) => {
            const isActive = u.status === 'active' || u.isActive === true

            return (
              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                {/* User Name & Email */}
                <td className="px-5 py-4 font-medium">
                  <div className="font-semibold text-text-primary">{u.name}</div>
                  <div className="text-[11px] text-text-muted font-normal mt-0.5">{u.email}</div>
                </td>

                {/* Role */}
                <td className="px-5 py-4">
                  <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                    {u.role}
                  </Badge>
                </td>

                {/* Branch */}
                <td className="px-5 py-4">
                  <span className="font-medium text-text-primary">
                    {u.branch || 'Headquarters / All'}
                  </span>
                </td>

                {/* Teams */}
                <td className="px-5 py-4">
                  {u.teams && u.teams.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {u.teams.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center text-[10px] font-medium bg-slate-100 text-text-muted rounded-badge px-2 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-muted/60 text-[11px] italic">No team</span>
                  )}
                </td>

                {/* Phone */}
                <td className="px-5 py-4 text-text-muted">
                  {u.phone || <span className="text-text-muted/40">—</span>}
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                  <Badge variant={isActive ? 'success' : 'error'} size="sm">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>

                {/* Last Login */}
                <td className="px-5 py-4 text-text-muted text-[11px]">
                  {u.lastLogin ? formatDateOnly(u.lastLogin) : <span className="text-text-muted/40">Never</span>}
                </td>

                {/* Actions */}
                <td className="px-5 py-4 text-right">
                  <UserActionMenu
                    user={u}
                    onEdit={onEdit}
                    onResetPassword={onResetPassword}
                    onToggleStatus={onToggleStatus}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
