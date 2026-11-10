import { useState, useRef, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Menu, LogOut, ChevronDown, KeyRound, Shield } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useHeader } from '@/context/HeaderContext'

export interface HeaderProps {
  onOpenMobileMenu: () => void
}

function getDefaultHeader(pathname: string): { title: string; subtitle: string } {
  if (pathname === '/' || pathname === '/dashboard') {
    return {
      title: 'Dashboard',
      subtitle: "Overview of your team's tasks and progress",
    }
  }
  if (pathname.startsWith('/schedule')) {
    return {
      title: 'Schedule',
      subtitle: 'Timeline calendar and deadline task visualization',
    }
  }
  if (pathname.startsWith('/my-tasks')) {
    return {
      title: 'My Tasks',
      subtitle: 'Tasks assigned to you and awaiting your action',
    }
  }
  if (pathname.startsWith('/history')) {
    return {
      title: 'Task History',
      subtitle: 'Archived and completed task records',
    }
  }
  if (pathname.startsWith('/tasks/new')) {
    return {
      title: 'Create Task',
      subtitle: 'Create and assign a new team task',
    }
  }
  if (pathname.startsWith('/tasks/')) {
    return {
      title: 'Task Details',
      subtitle: 'Task details and progress tracking',
    }
  }
  if (pathname.startsWith('/reports')) {
    return {
      title: 'Reports',
      subtitle: 'Performance analytics and team reporting',
    }
  }
  if (pathname.startsWith('/users')) {
    return {
      title: 'Users',
      subtitle: 'Manage staff accounts, credentials, and roles',
    }
  }
  if (pathname.startsWith('/branches-teams')) {
    return {
      title: 'Branches & Teams',
      subtitle: 'Manage organization branches, centers, and teams',
    }
  }
  if (pathname.startsWith('/roles')) {
    return {
      title: 'Roles & Permissions',
      subtitle: 'Configure system roles and permission matrices',
    }
  }
  if (pathname.startsWith('/change-password')) {
    return {
      title: 'Change Password',
      subtitle: 'Update your account password',
    }
  }
  return {
    title: 'Edu Wire',
    subtitle: 'Team Tracker',
  }
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageHeaderConfig = useHeader()
  const defaultHeader = getDefaultHeader(location.pathname)

  const title = pageHeaderConfig.title || defaultHeader.title
  const subtitle = pageHeaderConfig.subtitle || defaultHeader.subtitle
  const actions = pageHeaderConfig.actions

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    if (email) return email.slice(0, 2).toUpperCase()
    return 'U'
  }

  const initials = getInitials(user?.name, user?.email)

  return (
    <header className="h-18 px-6 sm:px-8 bg-surface border-b border-border-subtle flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left: Mobile menu toggle + Page Title & Subtitle */}
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open mobile navigation"
          className="lg:hidden p-2 rounded-nav text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-text-muted leading-tight mt-0.5 truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions cluster, Notification Bell & User Chip */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Dynamic Page Action buttons (Back, Edit, Create, etc.) */}
        {actions && (
          <div className="flex items-center gap-2 max-w-[200px] sm:max-w-none overflow-x-auto">
            {actions}
          </div>
        )}

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Chip & Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2.5 p-1 rounded-full sm:rounded-nav hover:bg-slate-50 border border-transparent hover:border-border-subtle transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-brand-blue-light text-brand-blue-text font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
              {initials}
            </div>
            <span className="hidden sm:inline text-sm font-semibold text-text-primary truncate max-w-[140px]">
              {user?.name || user?.email || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
          </button>

          {/* User Menu Dropdown */}
          {isMenuOpen && (
            <div
              role="menu"
              aria-orientation="vertical"
              className="absolute right-0 mt-2 w-60 rounded-card bg-surface border border-border-subtle shadow-dropdown py-1.5 z-40 text-left focus:outline-none animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-4 py-3 border-b border-border-subtle bg-slate-50/50">
                <p className="text-xs font-semibold text-text-primary truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-[11px] text-text-muted truncate mt-0.5">
                  {user?.email}
                </p>
                <div className="mt-2">
                  <Badge variant="primary" size="sm" className="text-[10px]">
                    {user?.role || 'Member'}
                  </Badge>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/change-password"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-text-muted" />
                  <span>Change Password</span>
                </Link>

                <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-text-muted/80">
                  <Shield className="w-3.5 h-3.5 text-text-muted/60" />
                  <span>ID: {user?.id?.slice(0, 8) || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t border-border-subtle pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setIsMenuOpen(false)
                    await logout()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-destructive hover:bg-tint-red-bg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
