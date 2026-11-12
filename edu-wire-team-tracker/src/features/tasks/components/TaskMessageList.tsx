import { MessageCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { TaskMessageItem } from './TaskMessageItem'
import type { TaskMessage } from '../types/taskMessage.types'

export interface TaskMessageListProps {
  messages: TaskMessage[]
  currentUserId: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  hasMore?: boolean
  onLoadEarlier?: () => void
  isLoadingEarlier?: boolean
}

export function TaskMessageList({
  messages,
  currentUserId,
  isLoading,
  isError,
  onRetry,
  hasMore = false,
  onLoadEarlier,
  isLoadingEarlier = false,
}: TaskMessageListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-text-muted">
        <Spinner size="sm" className="text-brand-blue" />
        <p className="text-xs">Loading discussion...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-5 px-4 text-center rounded-[10px] border border-dashed border-tint-red-border bg-tint-red-bg/40 space-y-2">
        <p className="text-xs font-medium text-tint-red-text">
          Could not load discussion.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="py-6 px-5 flex items-center justify-center gap-2.5 text-center rounded-[12px] border border-dashed border-border-subtle bg-slate-50/50 text-[13px] leading-5 text-text-muted">
        <MessageCircle className="w-4 h-4 text-text-muted shrink-0" />
        <span>No messages yet. Start a conversation.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Load Earlier button */}
      {hasMore && (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            isLoading={isLoadingEarlier}
            onClick={onLoadEarlier}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Load earlier messages
          </Button>
        </div>
      )}

      {/* Message list */}
      <div className="flex flex-col gap-3.5 py-0.5">
        {messages.map((msg) => (
          <TaskMessageItem
            key={msg.id}
            message={msg}
            isMine={msg.sender.id === currentUserId}
          />
        ))}
      </div>
    </div>
  )
}
