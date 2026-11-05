import { Layers, ShieldCheck } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { Card, CardContent } from '@/components/ui/Card'

export function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#F8FAFC] px-4 py-8 sm:px-6 lg:px-8">
      {/* Branding and Header */}
      <div className="w-full max-w-md mx-auto text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1D4ED8] text-white shadow-xs mb-4">
          <Layers className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
          Edu Wire Team Tracker
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">
          Sign in to access your tasks, branches, and team operations
        </p>
      </div>

      {/* Main Authentication Card */}
      <Card className="w-full max-w-md shadow-sm border border-[#E2E8F0]">
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
      </Card>

      {/* Security note footer */}
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-slate-400" />
        <span>Secure Enterprise Authentication • Edu Wire Internal Portal</span>
      </div>
    </div>
  )
}

