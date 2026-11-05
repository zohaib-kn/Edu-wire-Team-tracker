import { FileQuestion, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-400 mb-4 shadow-xs">
        <FileQuestion className="w-8 h-8" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8] mb-1">
        404 Error
      </span>
      <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight mb-2">
        Page Not Found
      </h1>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/dashboard">
        <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  )
}

