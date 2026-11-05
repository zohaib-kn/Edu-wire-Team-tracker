import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function AccessDenied({
  title = 'Access Restricted',
  description = 'You do not have the required permissions to view this section. If you believe this is an error, please contact your administrator.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-[#DC2626] mb-4 shadow-xs">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-semibold text-[#0F172A] tracking-tight mb-2">
        {title}
      </h2>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        {description}
      </p>
      <Link to="/dashboard">
        <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}

