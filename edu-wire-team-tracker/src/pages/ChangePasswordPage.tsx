import { KeyRound, ShieldAlert } from 'lucide-react'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { Card, CardContent } from '@/components/ui/Card'

export function ChangePasswordPage() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#F8FAFC] px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="w-full max-w-md mx-auto text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500 text-white shadow-xs mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
          Set a New Password
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">
          Your account was provisioned with a temporary password. Please set a secure password before proceeding.
        </p>
      </div>

      {/* Main Form Card */}
      <Card className="w-full max-w-md shadow-sm border border-[#E2E8F0]">
        <CardContent className="pt-6">
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Security note footer */}
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 text-center">
        <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
        <span>Mandatory Security Verification • Edu Wire Team Tracker</span>
      </div>
    </div>
  )
}

