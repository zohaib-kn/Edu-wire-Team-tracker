import { useLocation, NavLink } from 'react-router-dom'
import { LogOut, X, Layers } from 'lucide-react'
import { NAVIGATION_CONFIG } from './navConfig'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasPermission } from '@/lib/permissions/permissionChecker'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/Badge'

export interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()

  // Get user initials for avatar
  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'EW'
  }

  const initials = getInitials(user?.name, user?.email)

  const handleLogout = async () => {
    onClose()
    await logout()
  }

  // Filter sections and items based on permissions (strict permission check, no role string checks)
  const visibleSections = NAVIGATION_CONFIG.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission) return true
      return hasPermission(user, item.permission)
    }),
  })).filter((section) => section.items.length > 0)

  const sidebarContent = (
    <aside className="flex flex-col h-full w-[248px] bg-white border-r border-[#E2E8F0] select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1D4ED8] flex items-center justify-center text-white shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-[#0F172A] leading-tight">
              Edu Wire
            </span>
            <span className="text-[11px] font-medium text-slate-500 tracking-wide">
              Team Tracker
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar navigation"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav
        aria-label="Main Navigation"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
      >
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h4 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </h4>
            <div className="space-y-0.5 pt-1">
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
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-[#1D4ED8] font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isActive ? 'text-[#1D4ED8]' : 'text-slate-400',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile summary & logout footer */}
      <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/50 space-y-2">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-[#1D4ED8] font-semibold text-xs flex items-center justify-center shrink-0 border border-blue-200">
            {initials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#0F172A] truncate">
              {user?.name || user?.email || 'User'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="primary" size="sm" className="text-[10px] py-0 px-1.5">
                {user?.role || 'Member'}
              </Badge>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-[#DC2626] hover:bg-red-50/70 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-[#DC2626]" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop static sidebar */}
      <div className="hidden lg:block shrink-0">{sidebarContent}</div>

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
          <div className="relative z-10 flex flex-col w-[248px] max-w-[80vw] h-full shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

