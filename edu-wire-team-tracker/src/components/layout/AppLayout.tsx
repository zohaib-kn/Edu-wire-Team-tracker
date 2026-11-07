import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useNotificationToasts } from '@/features/notifications/hooks/useNotificationToasts'
import { CelebrationOverlay } from '@/features/tasks/components/CelebrationOverlay'

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Real-time toast notifications for task assignments and supervisions
  useNotificationToasts()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page">
      {/* Task Completion Celebration Animation */}
      <CelebrationOverlay />

      {/* Sidebar (Desktop static & Mobile drawer) */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main wrapper: Header + Content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
