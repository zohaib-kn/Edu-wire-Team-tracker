import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, LogOut, ChevronDown, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'

export interface HeaderProps {
  onOpenMobileMenu: () => void
}

function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return 'Dashboard'
  if (pathname.startsWith('/my-tasks')) return 'My Tasks'
  if (pathname.startsWith('/tasks/new')) return 'Create Task'
  if (pathname.startsWith('/tasks/')) return 'Task Details'
  if (pathname.startsWith('/reports')) return 'Reports'
  if (pathname.startsWith('/users')) return 'Users'
  if (pathname.startsWith('/branches-teams')) return 'Branches & Teams'
  if (pathname.startsWith('/roles')) return 'Roles & Permissions'
  if (pathname.startsWith('/change-password')) return 'Change Password'
  return 'Edu Wire'
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)

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
    <header className="h-16 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open mobile navigation"
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-[#0F172A] tracking-tight truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Right: User Profile Menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-[#E2E8F0] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1D4ED8] font-semibold text-xs flex items-center justify-center shrink-0 border border-blue-200">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-[#0F172A] leading-tight">
              {user?.name || user?.email || 'User'}
            </span>
            <span className="text-[11px] text-slate-500 leading-tight">
              {user?.role || 'Member'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-[#E2E8F0] shadow-lg py-1.5 z-40 text-left focus:outline-none"
          >
            <div className="px-3.5 py-2.5 border-b border-[#E2E8F0]">
              <p className="text-xs font-semibold text-[#0F172A] truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {user?.email}
              </p>
              <div className="mt-2">
                <Badge variant="primary" size="sm">
                  {user?.role || 'Member'}
                </Badge>
              </div>
            </div>

            <div className="py-1">
              <div className="px-3.5 py-1.5 flex items-center gap-2 text-xs text-slate-500">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Account ID: {user?.id?.slice(0, 8) || 'N/A'}</span>
              </div>
            </div>

            <div className="border-t border-[#E2E8F0] pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setIsMenuOpen(false)
                  await logout()
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-red-50/80 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

