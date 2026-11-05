import { useState } from 'react'
import { Copy, Check, FileText, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '../utils/reportUtils'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { DailyReportResponse } from '../types/report.types'

export interface DailyPendingReportProps {
  report?: DailyReportResponse
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

export function DailyPendingReport({
  report,
  isLoading,
  isError,
  onRetry,
}: DailyPendingReportProps) {
  const [copied, setCopied] = useState(false)
  const reportText = report?.reportText?.trim() || ''

  const handleCopy = async () => {
    if (!reportText) return
    const success = await copyToClipboard(reportText)
    if (success) {
      setCopied(true)
      toast.success('Report copied to clipboard', {
        description: 'The daily pending report text has been copied.',
      })
      setTimeout(() => setCopied(false), 2500)
    } else {
      toast.error('Failed to copy report', {
        description: 'Could not access clipboard. Please select and copy manually.',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Spinner size="lg" className="text-[#1D4ED8] mb-3" />
        <p className="text-sm font-medium">Generating daily pending report...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-800">
        <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto mb-2" />
        <p className="font-semibold mb-1">Failed to generate daily pending report</p>
        <p className="text-xs text-red-600 mb-4">
          The reporting service could not be reached or returned an error.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Try Again
        </Button>
      </div>
    )
  }

  if (!reportText) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center text-xs text-slate-400">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="font-semibold text-slate-700 text-sm mb-1">No pending tasks report</p>
        <p className="max-w-sm mx-auto text-slate-500">
          There are no pending tasks under the selected branch or team scope for today.
        </p>
      </div>
    )
  }

  return (
    <Card className="shadow-xs border border-[#E2E8F0]">
      {/* Action Bar */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#1D4ED8]" />
          <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Daily Pending Work Brief
          </span>
          {report?.date && (
            <span className="text-[11px] text-slate-500 font-medium">
              • {report.date}
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          leftIcon={copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        >
          {copied ? 'Copied' : 'Copy Report'}
        </Button>
      </div>

      {/* Whitespace-preserving Report Text Area */}
      <CardContent className="p-5 sm:p-6 bg-slate-900 text-slate-100 rounded-b-xl overflow-x-auto">
        <pre className="whitespace-pre-wrap font-mono text-xs sm:text-[13px] leading-relaxed text-slate-200 select-all font-normal">
          {reportText}
        </pre>
      </CardContent>
    </Card>
  )
}

