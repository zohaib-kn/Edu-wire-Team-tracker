import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Inbox, Check } from 'lucide-react'
import { useNotifications, useMarkAsRead, useMarkAllRead } from '../hooks/useNotifications'
import type { AppNotification } from '../types/notification.types'

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data, isLoading } = useNotifications()
  const { mutate: markAsRead } = useMarkAsRead()
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead()

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = (notif: AppNotification) => {
    if (notif.status === 'queued') {
      markAsRead(notif.id)
    }

    setIsOpen(false)

    if (notif.taskId) {
      navigate(`/tasks/${notif.taskId}`)
    }
  }

  const handleMarkAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    markAllRead()
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative w-10 h-10 rounded-nav border border-border-subtle bg-surface hover:bg-slate-50 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer"
      >
        <Bell className="w-5 h-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive ring-2 ring-surface shadow-xs" />
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div
          role="region"
          aria-label="Notifications Panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-card bg-surface border border-border-subtle shadow-dropdown z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-tint-blue-bg text-tint-blue-text border border-tint-blue-border rounded-badge">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isMarkingAll}
                className="text-xs text-brand-blue hover:text-brand-blue-hover font-medium flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border-subtle/50">
            {isLoading ? (
              <div className="p-5 space-y-3">
                <div className="animate-pulse flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-200 mt-2 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 rounded-inner w-3/4" />
                    <div className="h-3 bg-slate-100 rounded-inner w-5/6" />
                  </div>
                </div>
                <div className="animate-pulse flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-200 mt-2 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 rounded-inner w-2/3" />
                    <div className="h-3 bg-slate-100 rounded-inner w-4/5" />
                  </div>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-11 h-11 rounded-full bg-slate-100 text-text-muted mx-auto flex items-center justify-center mb-2.5">
                  <Inbox className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <p className="text-xs font-semibold text-text-primary">All caught up!</p>
                <p className="text-[11px] text-text-muted mt-0.5">No new notifications</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = notif.status === 'queued'
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleNotificationClick(notif)
                      }
                    }}
                    className={`w-full p-4 text-left transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-50/80 group ${
                      isUnread ? 'bg-tint-blue-bg/20' : 'bg-surface'
                    }`}
                  >
                    {/* Unread Indicator Dot */}
                    <div className="pt-1.5 shrink-0">
                      <span
                        className={`block w-2 h-2 rounded-full ${
                          isUnread ? 'bg-brand-blue' : 'bg-transparent'
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs ${
                          isUnread ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'
                        } truncate`}
                      >
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.body}
                        </p>
                      )}
                      <span className="text-[10px] text-text-muted/70 mt-1 block">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    {/* Quick mark as read button */}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notif.id)
                        }}
                        title="Mark as read"
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-brand-blue rounded-badge transition-all shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
