import { useLocation, NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import eduwireLogo from '@/assets/eduwire-logo.png'
import { NAVIGATION_CONFIG } from './navConfig'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasPermission } from '@/lib/permissions/permissionChecker'
import { cn } from '@/lib/utils/cn'

export interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const handleLogout = async () => {
    onClose()
    await logout()
  }

  // Filter sections and items based on permissions (strict permission check, unchanged)
  const visibleSections = NAVIGATION_CONFIG.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission) return true
      return hasPermission(user, item.permission)
    }),
  })).filter((section) => section.items.length > 0)

  const sidebarContent = (
    <aside className="flex flex-col h-full w-[272px] bg-surface border-r border-border-subtle select-none">
      {/* Brand Header */}
      <div className="h-18 px-6 flex items-center justify-between border-b border-border-subtle shrink-0">
        <NavLink
          to="/dashboard"
          className="flex items-center min-w-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-md"
          title="Edu Wire Team Tracker"
        >
          <img
            src={eduwireLogo}
            alt="Edu Wire Team Tracker"
            className="h-10 w-auto max-w-[190px] object-contain"
          />
        </NavLink>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar navigation"
          className="lg:hidden p-1.5 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav
        aria-label="Main Navigation"
        className="flex-1 overflow-y-auto px-4 py-5 space-y-6"
      >
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h4 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted/70">
              {section.title}
            </h4>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.path === '/dashboard'
                    ? location.pathname === '/dashboard' || location.pathname === '/'
                    : location.pathname.startsWith(item.path)

                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3.5 h-11 rounded-nav text-sm transition-all duration-150',
                      isActive
                        ? 'bg-brand-blue-light text-brand-blue-text font-semibold shadow-xs'
                        : 'text-text-muted hover:bg-slate-50 hover:text-text-primary font-medium',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0 transition-colors',
                        isActive ? 'text-brand-blue' : 'text-text-muted group-hover:text-text-primary',
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pinned Sign Out Footer */}
      <div className="p-4 border-t border-border-subtle shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 h-11 rounded-nav text-sm font-medium text-text-muted hover:text-destructive hover:bg-tint-red-bg transition-colors cursor-pointer group"
        >
          <LogOut className="w-[18px] h-[18px] text-text-muted group-hover:text-destructive transition-colors shrink-0" strokeWidth={1.75} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop static sidebar */}
      <div className="hidden lg:block shrink-0 h-screen sticky top-0">{sidebarContent}</div>

      {/* Mobile drawer overlay & slide-in */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative z-10 flex flex-col w-[272px] max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
