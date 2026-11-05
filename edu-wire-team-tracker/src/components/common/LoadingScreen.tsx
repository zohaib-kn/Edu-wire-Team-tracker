import { Spinner } from '@/components/ui/Spinner'

export function LoadingScreen({ message = 'Verifying authentication...' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 text-slate-700"
    >
      <div className="flex flex-col items-center space-y-4 p-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-[#1D4ED8] shadow-xs">
          <Spinner size="lg" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A] tracking-tight">
            Edu Wire Team Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}

