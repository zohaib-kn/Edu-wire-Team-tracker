import { useEffect, useRef, type MutableRefObject } from 'react'
import { useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlarmClock, AlertTriangle, CheckCircle2, MessageSquare, ClipboardList, Eye, X } from 'lucide-react'
import { useNotifications, useMarkAsRead } from './useNotifications'
import { getTaskDetailNavState } from '@/features/tasks/utils/taskNavigation'
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
 * toast alerts for task assignments, discussion messages, completion,
 * and time-sensitive deadline warnings / escalations.
 */
export function useNotificationToasts() {
  const { data } = useNotifications()
  const { mutate: markAsRead } = useMarkAsRead()
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef<Location>(location)

  useEffect(() => {
    locationRef.current = location
  }, [location])

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
          displayDeadlineAlertToast(notif, navigate, locationRef, markAsRead)
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
      displayDeadlineAlertToast(notif, navigate, locationRef, markAsRead)
    })
  }, [data, navigate, markAsRead])
}

/**
 * Renders an interactive toast alert matching Edu Wire's clean blue-and-white design system.
 * Includes dedicated styling for deadline advance warnings and escalations with AlarmClock icon.
 */
function displayDeadlineAlertToast(
  notif: AppNotification,
  navigate: NavigateFunction,
  locationRef: MutableRefObject<Location>,
  markAsRead: (id: string) => void,
) {
  const isWarning = notif.type === 'deadline_warning'
  const isEscalation = notif.type === 'deadline_escalation'
  const isOwner = notif.type === 'task_assigned'
  const isDiscussion = notif.type === 'task_discussion_message'
  const isCompleted = notif.type === 'task_completed'

  const title =
    notif.title ||
    (isWarning
      ? 'Task Deadline Warning'
      : isEscalation
        ? 'Deadline Reached'
        : isCompleted
          ? 'Task Completed 🎉'
          : isDiscussion
            ? 'New Task Update'
            : isOwner
              ? 'New Task Assigned'
              : 'New Task Under Your Supervision')

  const body = notif.body || 'A new update requires your attention.'

  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in zoom-in-95' : 'animate-out fade-out'
        } max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex border ${
          isWarning
            ? 'border-amber-300 ring-1 ring-amber-200'
            : isEscalation
              ? 'border-rose-300 ring-1 ring-rose-200'
              : 'border-slate-200'
        } overflow-hidden cursor-pointer hover:bg-slate-50/80 transition-colors`}
        onClick={() => {
          markAsRead(notif.id)
          toast.dismiss(t.id)
          if (notif.taskId) {
            const target = isDiscussion
              ? `/tasks/${encodeURIComponent(notif.taskId)}?tab=discussion`
              : `/tasks/${encodeURIComponent(notif.taskId)}`
            navigate(target, { state: getTaskDetailNavState(locationRef.current) })
          }
        }}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start gap-3">
            {/* Notification Badge Icon */}
            <div className="shrink-0 pt-0.5">
              <span
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${
                  isWarning
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : isEscalation
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : isCompleted
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : isDiscussion
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : isOwner
                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                }`}
              >
                {isWarning ? (
                  <AlarmClock className="w-5 h-5 animate-pulse" />
                ) : isEscalation ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isDiscussion ? (
                  <MessageSquare className="w-5 h-5" />
                ) : isOwner ? (
                  <ClipboardList className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </span>
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-900 tracking-tight truncate">{title}</p>
                {isWarning && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded">
                    Urgent
                  </span>
                )}
                {isEscalation && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 rounded">
                    Overdue
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-snug line-clamp-2">{body}</p>
              {notif.taskId && (
                <p className="mt-1.5 text-[11px] font-semibold text-blue-600 flex items-center gap-1 hover:underline">
                  {isDiscussion
                    ? 'Click to view discussion \u2192'
                    : isCompleted
                      ? 'Click to view completed task \u2192'
                      : 'Click to view task \u2192'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Dismiss Button - only dismisses popup in current UI, never marks done or alters status */}
        <div className="flex border-l border-slate-200">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toast.dismiss(t.id)
            }}
            className="w-full border border-transparent rounded-none rounded-r-xl px-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors focus:outline-none cursor-pointer"
            aria-label="Dismiss notification"
            title="Dismiss popup (stays in notifications)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    ),
    {
      id: `toast-${notif.id}`,
      duration: isWarning || isEscalation ? 12000 : 8000,
    },
  )
}
