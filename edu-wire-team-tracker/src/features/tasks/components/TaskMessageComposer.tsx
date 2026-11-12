import { useState, useRef, useCallback } from 'react'
import { Send, HelpCircle, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import type { TaskMessageType } from '../types/taskMessage.types'
import type { User } from '@/features/auth/types/auth.types'

const MAX_CHARS = 5000

/** Roles that can send typed question / instruction messages. */
function canSendTyped(role: string): boolean {
  return ['Super Admin', 'Branch Admin', 'Team Lead'].includes(role)
}

export interface TaskMessageComposerProps {
  onSend: (body: string, type: TaskMessageType) => Promise<void>
  isSending: boolean
  currentUser: User
  taskIsDone?: boolean
}

export function TaskMessageComposer({
  onSend,
  isSending,
  currentUser,
  taskIsDone = false,
}: TaskMessageComposerProps) {
  const [body, setBody] = useState('')
  const [selectedType, setSelectedType] = useState<TaskMessageType>('reply')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = body.trim()
  const isOverLimit = body.length > MAX_CHARS
  const canSubmit = trimmed.length > 0 && !isOverLimit && !isSending

  // Auto-resize textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    // Auto-grow
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  const handleSend = useCallback(async () => {
    if (!canSubmit) return
    const snapshot = body
    try {
      await onSend(snapshot.trim(), selectedType)
      // Clear only after confirmed success
      setBody('')
      setSelectedType('reply')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // onSend already shows toast; preserve draft text on failure
    }
  }, [body, canSubmit, onSend, selectedType])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const setTypeAndFocus = (type: TaskMessageType) => {
    setSelectedType(type)
    textareaRef.current?.focus()
  }

  const showTypePicker = canSendTyped(currentUser.role)

  type TypeOption =
    | { type: TaskMessageType; label: string; Icon?: undefined }
    | { type: TaskMessageType; label: string; Icon: React.ComponentType<{ className?: string }> }

  const typeOptions: TypeOption[] = [
    { type: 'reply', label: 'Reply' },
    { type: 'question', label: 'Ask for Update', Icon: HelpCircle },
    { type: 'instruction', label: 'Add Instruction', Icon: BookOpen },
  ]

  return (
    <div className="border border-border-subtle rounded-[12px] bg-surface shadow-card overflow-hidden">
      {/* Quick type selectors — only shown to admins and leads */}
      {showTypePicker && (
        <div className="flex items-center flex-wrap gap-2 px-4 py-2.5 border-b border-border-subtle/60">
          <span className="text-xs text-text-muted font-medium shrink-0 mr-0.5">Send as:</span>
          {typeOptions.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeAndFocus(type)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11.5px] font-medium border transition-colors whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
                selectedType === type
                  ? type === 'question'
                    ? 'bg-tint-blue-bg text-brand-blue border-tint-blue-border'
                    : type === 'instruction'
                      ? 'bg-tint-amber-bg text-tint-amber-text border-tint-amber-border'
                      : 'bg-slate-100 text-text-primary border-border-subtle'
                  : 'bg-transparent text-text-muted border-transparent hover:border-border-subtle hover:bg-slate-50',
              )}
              aria-pressed={selectedType === type}
            >
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isSending}
          placeholder={
            taskIsDone
              ? 'Task is done — you can still add notes to the discussion...'
              : 'Ask for an update or write a reply...'
          }
          aria-label="Discussion message"
          className={cn(
            'w-full resize-none px-4 py-3.5 text-[13.5px] text-text-primary bg-transparent',
            'placeholder:text-text-muted/70 leading-6',
            'focus:outline-none',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'min-h-[84px] max-h-[160px]',
          )}
          style={{ overflow: 'hidden' }}
        />
      </div>

      {/* Footer: char count + send */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border-subtle/60">
        <span
          className={cn(
            'text-[11px] tabular-nums',
            isOverLimit ? 'text-destructive font-semibold' : 'text-text-muted',
          )}
        >
          {body.length}/{MAX_CHARS}
        </span>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-text-muted hidden sm:inline select-none">
            Shift+Enter for new line
          </span>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSending}
            disabled={!canSubmit}
            onClick={handleSend}
            aria-label="Send message"
            leftIcon={!isSending ? <Send className="w-3.5 h-3.5" /> : undefined}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
