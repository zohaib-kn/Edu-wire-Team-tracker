import { useState } from 'react'
import { KeyRound, Copy, Check, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useResetPassword } from '../hooks/useUserMutations'
import type { ManagedUser } from '../types/userAdmin.types'

export interface ResetPasswordDialogProps {
  user: ManagedUser | null
  isOpen: boolean
  onClose: () => void
}

export function ResetPasswordDialog({
  user,
  isOpen,
  onClose,
}: ResetPasswordDialogProps) {
  const [copied, setCopied] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const resetMutation = useResetPassword()

  if (!user) return null

  const handleReset = async () => {
    try {
      const result = await resetMutation.mutateAsync(user.id)
      if (result.temporaryPassword) {
        setTempPassword(result.temporaryPassword)
      } else {
        onClose()
      }
    } catch {
      // Toast notification is triggered by mutation hook
    }
  }

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setTempPassword(null)
    setCopied(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reset Staff Password"
      footer={
        tempPassword ? (
          <Button variant="primary" size="sm" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={resetMutation.isPending}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={resetMutation.isPending}
              onClick={handleReset}
            >
              Confirm Reset
            </Button>
          </>
        )
      }
    >
      {tempPassword ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-900 text-xs">
            <Check className="w-4 h-4 text-green-600 shrink-0" />
            <span>Password reset successfully. Please securely share the temporary password with {user.name}.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              New Temporary Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={tempPassword}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 select-all"
              />
              <Button
                variant="outline"
                size="md"
                onClick={handleCopy}
                leftIcon={copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              The user will be required to change this password on their next sign-in.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-[#0F172A] mb-1">
              Reset password for {user.name}?
            </p>
            <p className="text-slate-500 text-xs mb-2 leading-relaxed">
              This will invalidate their existing password. A temporary password will be issued, and the user must set a new secure password upon their next login.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200/70">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Current active sessions for this user may be terminated.</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

