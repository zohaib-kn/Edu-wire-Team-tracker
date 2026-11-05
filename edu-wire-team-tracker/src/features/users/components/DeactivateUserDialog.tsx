import { UserX, UserCheck, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToggleUserStatus } from '../hooks/useUserMutations'
import type { ManagedUser } from '../types/userAdmin.types'

export interface DeactivateUserDialogProps {
  user: ManagedUser | null
  isOpen: boolean
  onClose: () => void
}

export function DeactivateUserDialog({
  user,
  isOpen,
  onClose,
}: DeactivateUserDialogProps) {
  const toggleStatusMutation = useToggleUserStatus()

  if (!user) return null

  const isCurrentlyActive = user.status === 'active' || user.isActive === true
  const isTargetSuperAdmin = user.role === 'Super Admin'

  const handleToggle = async () => {
    try {
      await toggleStatusMutation.mutateAsync({
        id: user.id,
        active: !isCurrentlyActive,
        name: user.name,
      })
      onClose()
    } catch {
      // Handled by mutation hook toast
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCurrentlyActive ? 'Deactivate Staff Account' : 'Reactivate Staff Account'}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={toggleStatusMutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant={isCurrentlyActive ? 'danger' : 'primary'}
            size="sm"
            isLoading={toggleStatusMutation.isPending}
            onClick={handleToggle}
          >
            {isCurrentlyActive ? 'Yes, Deactivate Account' : 'Yes, Reactivate Account'}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isCurrentlyActive ? 'bg-red-100 text-[#DC2626]' : 'bg-green-100 text-[#16A34A]'
          }`}
        >
          {isCurrentlyActive ? (
            <UserX className="w-5 h-5" />
          ) : (
            <UserCheck className="w-5 h-5" />
          )}
        </div>

        <div className="text-sm">
          <p className="font-semibold text-[#0F172A] mb-1">
            {isCurrentlyActive
              ? `Deactivate account for ${user.name}?`
              : `Reactivate account for ${user.name}?`}
          </p>

          <p className="text-slate-500 text-xs mb-3 leading-relaxed">
            {isCurrentlyActive
              ? 'Deactivating this account will immediately revoke all application access and terminate all active sessions. The user will be unable to log in until reactivated.'
              : 'Reactivating this account will restore staff access and permit sign-in.'}
          </p>

          {isCurrentlyActive && isTargetSuperAdmin && (
            <div className="flex items-start gap-1.5 p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> The system requires at least one active Super Admin. If this is the last Super Admin account, the server will reject this action.
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

