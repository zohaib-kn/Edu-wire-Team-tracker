import { useState, useCallback, type FocusEvent, type MouseEvent } from 'react'
import { useLocation, NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react'
import eduwireLogo from '@/assets/eduwire-logo.png'
import { NAVIGATION_CONFIG } from './navConfig'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { hasPermission } from '@/lib/permissions/permissionChecker'
import { cn } from '@/lib/utils/cn'

export interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface FloatingTooltip {
  label: string
  top: number
  left: number
}

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [tooltip, setTooltip] = useState<FloatingTooltip | null>(null)

  const handleLogout = async () => {
    setTooltip(null)
    onClose()
    await logout()
  }

  const showTooltip = useCallback(
    (label: string, target: HTMLElement) => {
      const rect = target.getBoundingClientRect()
      setTooltip({
        label,
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      })
    },
    [],
  )

  const hideTooltip = useCallback(() => {
    setTooltip(null)
  }, [])

  // Filter sections and items based on permissions (strict permission check, unchanged)
  const visibleSections = NAVIGATION_CONFIG.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission) return true
      return hasPermission(user, item.permission)
    }),
  })).filter((section) => section.items.length > 0)

  const renderSidebarBody = (collapsed: boolean) => (
    <aside
      aria-label="Sidebar"
      className={cn(
        'flex flex-col h-full bg-surface border-r border-border-subtle select-none transition-[width] duration-200 ease-in-out overflow-x-hidden',
        collapsed ? 'w-[76px]' : 'w-[272px]',
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'h-18 flex items-center border-b border-border-subtle shrink-0 transition-[padding] duration-200',
          collapsed ? 'px-2 justify-center' : 'px-6 justify-between',
        )}
      >
        <NavLink
          to="/dashboard"
          onClick={() => {
            hideTooltip()
            onClose()
          }}
          className="flex items-center min-w-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-md"
          title="Edu Wire Team Tracker"
          aria-label="Edu Wire Team Tracker Dashboard"
        >
          {collapsed ? (
            <div className="w-[39px] h-8 overflow-hidden shrink-0">
              <img
                src={eduwireLogo}
                alt="Edu Wire"
                className="h-8 w-auto max-w-none object-left"
              />
            </div>
          ) : (
            <img
              src={eduwireLogo}
              alt="Edu Wire Team Tracker"
              className="h-10 w-auto max-w-[190px] object-contain"
            />
          )}
        </NavLink>

        {/* Mobile close button */}
        {!collapsed && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar navigation"
            className="lg:hidden p-1.5 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav
        aria-label="Main Navigation"
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden py-5 transition-[padding] duration-200',
          collapsed ? 'px-2.5 space-y-4' : 'px-4 space-y-6',
        )}
      >
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.title} className="space-y-1.5">
            {collapsed ? (
              sectionIndex > 0 && (
                <div
                  className="mx-2 border-t border-border-subtle/80"
                  aria-hidden="true"
                />
              )
            ) : (
              <h4 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted/70">
                {section.title}
              </h4>
            )}
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
                    onClick={() => {
                      hideTooltip()
                      onClose()
                    }}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                    onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
                      if (collapsed) showTooltip(item.label, e.currentTarget)
                    }}
                    onMouseLeave={hideTooltip}
                    onFocus={(e: FocusEvent<HTMLAnchorElement>) => {
                      if (collapsed) showTooltip(item.label, e.currentTarget)
                    }}
                    onBlur={hideTooltip}
                    className={cn(
                      'group flex items-center h-11 rounded-nav text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
                      collapsed ? 'justify-center px-0' : 'gap-3 px-3.5',
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
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pinned Sign Out Footer */}
      <div
        className={cn(
          'border-t border-border-subtle shrink-0 transition-[padding] duration-200',
          collapsed ? 'p-2.5' : 'p-4',
        )}
      >
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign Out"
          title={collapsed ? 'Sign Out' : undefined}
          onMouseEnter={(e) => {
            if (collapsed) showTooltip('Sign Out', e.currentTarget)
          }}
          onMouseLeave={hideTooltip}
          onFocus={(e) => {
            if (collapsed) showTooltip('Sign Out', e.currentTarget)
          }}
          onBlur={hideTooltip}
          className={cn(
            'w-full flex items-center h-11 rounded-nav text-sm font-medium text-text-muted hover:text-destructive hover:bg-tint-red-bg transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3.5',
          )}
        >
          <LogOut
            className="w-[18px] h-[18px] text-text-muted group-hover:text-destructive transition-colors shrink-0"
            strokeWidth={1.75}
          />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop collapsible sidebar */}
      <div
        className={cn(
          'hidden lg:block relative shrink-0 h-screen sticky top-0 z-[35] transition-[width] duration-200 ease-in-out',
          isCollapsed ? 'w-[76px]' : 'w-[272px]',
        )}
      >
        {renderSidebarBody(isCollapsed)}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={() => {
              hideTooltip()
              onToggleCollapse()
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-full bg-surface border border-border-subtle text-text-muted hover:text-text-primary hover:bg-slate-50 shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue cursor-pointer absolute top-[22px] -right-3.5 z-10"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Fixed-position accessible tooltip for collapsed rail icons */}
        {isCollapsed && tooltip && (
          <div
            role="tooltip"
            style={{ top: tooltip.top, left: tooltip.left }}
            className="fixed z-50 -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-badge bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md"
          >
            {tooltip.label}
          </div>
        )}
      </div>

      {/* Mobile drawer overlay & slide-in (always full expanded width) */}
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
            {renderSidebarBody(false)}
          </div>
        </div>
      )}
    </>
  )
}
