import { useEffect } from 'react'
import { useCelebration, dismissCelebration } from '../utils/celebrationTrigger'
import celebrationSvg from '@/assets/success-celebration.svg'

export function CelebrationOverlay() {
  const { isCelebrating, taskTitle, key } = useCelebration()

  useEffect(() => {
    if (!isCelebrating) return

    const timer = setTimeout(() => {
      dismissCelebration()
    }, 2400)

    return () => clearTimeout(timer)
  }, [isCelebrating, key])

  if (!isCelebrating) return null

  return (
    <aside
      aria-label="Task completion celebration"
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
    >
      <div className="relative flex flex-col items-center justify-center animate-in fade-in zoom-in-75 duration-200">
        {/* Animated Celebration SVG */}
        <img
          key={key}
          src={`${celebrationSvg}?k=${key}`}
          alt="Success celebration"
          className="w-64 h-64 sm:w-80 sm:h-80 object-contain drop-shadow-2xl"
        />

        {/* Celebratory Pill */}
        <div className="-mt-6 flex flex-col items-center bg-surface/95 backdrop-blur-md px-5 py-2.5 rounded-full border border-border-subtle shadow-dropdown text-center max-w-sm animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-text-primary">
            <span>🎉</span>
            <span className="text-[#15803D]">Task Completed!</span>
          </div>
          {taskTitle && (
            <p className="text-[11px] text-text-muted truncate max-w-[240px] mt-0.5">
              {taskTitle}
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
