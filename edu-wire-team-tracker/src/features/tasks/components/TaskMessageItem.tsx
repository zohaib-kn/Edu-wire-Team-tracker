import { cn } from '@/lib/utils/cn'
import type { TaskMessage } from '../types/taskMessage.types'

// ─── timestamp formatter ─────────────────────────────────────────────────────
function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return isoString
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return isoString
  }
}

// ─── sender initials ──────────────────────────────────────────────────────────
function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

// ─── type label ───────────────────────────────────────────────────────────────
function getTypeLabel(type: string): string | null {
  if (type === 'question') return 'Question'
  if (type === 'instruction') return 'Instruction'
  return null // 'reply' shows no badge — it is the default context
}

// ─── type accent colour ───────────────────────────────────────────────────────
function getTypeBadgeClass(type: string): string {
  if (type === 'question') return 'bg-tint-blue-bg text-brand-blue border-tint-blue-border'
  if (type === 'instruction') return 'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border'
  return 'bg-slate-100 text-text-muted border-border-subtle'
}

// ─── sender role colour ───────────────────────────────────────────────────────
function getAvatarColour(role: string): string {
  if (role === 'Super Admin') return 'bg-tint-blue-bg text-brand-blue border border-tint-blue-border'
  if (role === 'Branch Admin') return 'bg-tint-amber-bg text-tint-amber-text border border-tint-amber-border'
  if (role === 'Team Lead') return 'bg-tint-green-bg text-tint-green-text border border-tint-green-border'
  return 'bg-slate-100 text-text-muted border border-border-subtle'
}

// ─── component ────────────────────────────────────────────────────────────────
export interface TaskMessageItemProps {
  message: TaskMessage
  /** Whether the current user is the sender of this message. */
  isMine: boolean
}

export function TaskMessageItem({ message, isMine }: TaskMessageItemProps) {
  const initials = getInitials(message.sender.name)
  const avatarColour = getAvatarColour(message.sender.role)
  const typeLabel = getTypeLabel(message.type)

  return (
    <div
      className={cn(
        'flex items-start gap-2.5',
        isMine ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar / Initials */}
      <div
        aria-hidden="true"
        className={cn(
          'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold select-none',
          avatarColour,
        )}
        title={`${message.sender.name} (${message.sender.role})`}
      >
        {initials}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          'max-w-[82%] sm:max-w-[75%] flex flex-col gap-1',
          isMine ? 'items-end' : 'items-start',
        )}
      >
        {/* Sender line */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px]',
            isMine ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span className="font-semibold text-text-primary">
            {isMine ? 'You' : message.sender.name}
          </span>
          {!isMine && (
            <span className="text-text-muted">· {message.sender.role}</span>
          )}
          {typeLabel && (
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-badge text-[10px] font-semibold border',
                getTypeBadgeClass(message.type),
              )}
            >
              {typeLabel}
            </span>
          )}
        </div>

        {/* Body bubble */}
        <div
          className={cn(
            'rounded-inner px-3.5 py-2.5 text-sm leading-relaxed',
            'border shadow-card',
            isMine
              ? 'bg-tint-blue-bg text-text-primary border-tint-blue-border rounded-tr-sm'
              : 'bg-surface text-text-primary border-border-subtle rounded-tl-sm',
          )}
        >
          {/* Plain text — whitespace preserved, HTML not interpreted */}
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>

        {/* Timestamp */}
        <time
          dateTime={message.createdAt}
          className="text-[10px] text-text-muted px-0.5"
        >
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
    </div>
  )
}

