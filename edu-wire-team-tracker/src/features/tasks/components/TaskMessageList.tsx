import { useEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
        <Spinner size="md" className="text-brand-blue" />
        <p className="text-xs">Loading discussion...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={<MessageCircle className="w-5 h-5" />}
        title="Could not load discussion"
        description="There was an error loading messages. Please try again."
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    )
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle className="w-5 h-5" />}
        title="No messages yet"
        description="Start the conversation by asking for an update or leaving an instruction below."
      />
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
      <div className="flex flex-col gap-4 py-1">
        {messages.map((msg) => (
          <TaskMessageItem
            key={msg.id}
            message={msg}
            isMine={msg.sender.id === currentUserId}
          />
        ))}
      </div>

      {/* Scroll anchor */}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}

