import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useNotifications, useMarkAsRead } from './useNotifications'
import type { AppNotification } from '../types/notification.types'

const STORAGE_KEY = 'edu_seen_notif_ids'
const RECENT_CUTOFF_MS = 3 * 60 * 1000 // 3 minutes

function getStoredSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch {
    // sessionStorage might be restricted in some environments
  }
  return new Set()
}

function storeSeenId(id: string) {
  try {
    const current = getStoredSeenIds()
    current.add(id)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)))
  } catch {
    // ignore storage errors
  }
}

/**
 * Listens for newly arrived notifications and displays real-time
 * toast alerts to the Task Owner and Reporting Manager.
 */
export function useNotificationToasts() {
  const { data } = useNotifications()
  const { mutate: markAsRead } = useMarkAsRead()
  const navigate = useNavigate()

  // Track notification IDs that have already been seen/processed
  const seenIdsRef = useRef<Set<string>>(getStoredSeenIds())
  const isInitialLoadRef = useRef(true)

  useEffect(() => {
    const notifications = data?.notifications || []
    if (notifications.length === 0) return

    const now = Date.now()

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false

      notifications.forEach((notif) => {
        const notifTime = new Date(notif.createdAt).getTime()
        const isRecent = now - notifTime <= RECENT_CUTOFF_MS
        const alreadySeen = seenIdsRef.current.has(notif.id)

        if (!alreadySeen && notif.status === 'queued' && isRecent) {
          // Toast recent notifications even on initial load/refresh (within 3 mins)
          seenIdsRef.current.add(notif.id)
          storeSeenId(notif.id)
          displayAssignmentToast(notif, navigate, markAsRead)
        } else {
          // Record older or already-seen notifications as seen without toasting
          seenIdsRef.current.add(notif.id)
          storeSeenId(notif.id)
        }
      })
      return
    }

    // Subsequent background polls: toast any new unread notification
    const newNotifications = notifications.filter(
      (n) => !seenIdsRef.current.has(n.id) && n.status === 'queued',
    )

    newNotifications.forEach((notif) => {
      seenIdsRef.current.add(notif.id)
      storeSeenId(notif.id)
      displayAssignmentToast(notif, navigate, markAsRead)
    })
  }, [data, navigate, markAsRead])
}

/**
 * Renders an interactive toast alert using react-hot-toast matching design tokens.
 */
function displayAssignmentToast(
  notif: AppNotification,
  navigate: (path: string) => void,
  markAsRead: (id: string) => void,
) {
  const isOwner = notif.type === 'task_assigned'

  const title = notif.title || (isOwner ? 'New Task Assigned' : 'New Task Under Your Supervision')
  const body = notif.body || 'A new task requires your attention.'

  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in zoom-in-95' : 'animate-out fade-out'
        } max-w-md w-full bg-surface shadow-dropdown rounded-inner pointer-events-auto flex border border-border-subtle overflow-hidden cursor-pointer hover:bg-slate-50/80 transition-colors`}
        onClick={() => {
          markAsRead(notif.id)
          toast.dismiss(t.id)
          if (notif.taskId) {
            navigate(`/tasks/${notif.taskId}`)
          }
        }}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            {/* Notification Badge Icon */}
            <div className="shrink-0 pt-0.5">
              <span
                className={`inline-flex items-center justify-center w-9 h-9 rounded-nav text-lg border ${
                  isOwner
                    ? 'bg-tint-blue-bg text-tint-blue-text border-tint-blue-border'
                    : 'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border'
                }`}
              >
                {isOwner ? '📋' : '👀'}
              </span>
            </div>

            {/* Notification Text */}
            <div className="ml-3 flex-1">
              <p className="text-xs font-semibold text-text-primary tracking-tight">{title}</p>
              <p className="mt-1 text-xs text-text-muted leading-snug line-clamp-2">{body}</p>
              {notif.taskId && (
                <p className="mt-1.5 text-[11px] font-semibold text-brand-blue flex items-center gap-1">
                  Click to view task &rarr;
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex border-l border-border-subtle">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toast.dismiss(t.id)
            }}
            className="w-full border border-transparent rounded-none rounded-r-inner px-4 flex items-center justify-center text-xs font-medium text-text-muted hover:text-text-primary focus:outline-none cursor-pointer"
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      </div>
    ),
    {
      id: `toast-${notif.id}`,
      duration: 8000,
    },
  )
}
