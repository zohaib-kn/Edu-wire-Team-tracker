import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from './PageHeader'

export interface PlaceholderPageProps {
  title: string
  phase: string
  description: string
  icon?: LucideIcon
}

export function PlaceholderPage({
  title,
  phase,
  description,
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Badge variant="neutral" size="sm">
            Scheduled for {phase}
          </Badge>
        }
      />

      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
        {Icon && (
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-50 border border-[#E2E8F0] flex items-center justify-center text-slate-400 mb-4">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <h3 className="text-base font-semibold text-[#0F172A] mb-1">
          {title} Module
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
          This interface is scheduled for development in <span className="font-semibold text-slate-700">{phase}</span>. Architecture, permissions, and routing are configured and ready.
        </p>
        <span className="inline-flex items-center text-xs text-slate-400">
          Edu Wire Team Tracker • Phase 1 Foundation
        </span>
      </div>
    </div>
  )
}

