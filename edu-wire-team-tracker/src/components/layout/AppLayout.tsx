import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useNotificationToasts } from '@/features/notifications/hooks/useNotificationToasts'
import { CelebrationOverlay } from '@/features/tasks/components/CelebrationOverlay'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'eduwire.sidebar.collapsed'

function readSavedSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(readSavedSidebarCollapsed)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed))
    } catch {
      // Ignore storage errors (e.g. private browsing restrictions)
    }
  }, [isSidebarCollapsed])

  // Real-time toast notifications for task assignments and supervisions
  useNotificationToasts()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page">
      {/* Task Completion Celebration Animation */}
      <CelebrationOverlay />

      {/* Sidebar (Desktop collapsible rail & Mobile drawer) */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main wrapper: Header + Content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
