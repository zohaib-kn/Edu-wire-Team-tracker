import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTaskMessages } from '../hooks/useTaskMessages'
import { usePostTaskMessage } from '../hooks/usePostTaskMessage'
import { TaskMessageList } from './TaskMessageList'
import { TaskMessageComposer } from './TaskMessageComposer'
import type { TaskMessageType } from '../types/taskMessage.types'

export interface TaskDiscussionProps {
  taskId: string
  taskIsDone?: boolean
}

/**
 * Self-contained discussion panel for a task.
 * Renders the message list + composer.
 * Handles all data fetching and mutation internally.
 */
export function TaskDiscussion({ taskId, taskIsDone = false }: TaskDiscussionProps) {
  const { user } = useAuth()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hasInitializedRef = useRef(false)
  const prevLengthRef = useRef(0)

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useTaskMessages(taskId)

  const { mutateAsync: postMessage, isPending: isSending } = usePostTaskMessage(taskId)

  const messages = data?.messages ?? []
  const currentUserId = user?.id ?? ''

  // Keep scroll stable on initial load; scroll inside message container when new messages arrive
  useEffect(() => {
    if (isLoading) return

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      prevLengthRef.current = messages.length
      return
    }

    if (messages.length > prevLengthRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
    prevLengthRef.current = messages.length
  }, [isLoading, messages.length])

  const handleSend = useCallback(
    async (body: string, type: TaskMessageType) => {
      if (!body.trim()) return
      await postMessage({ body: body.trim(), type })
      toast.success('Message sent')
    },
    [postMessage],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Message list: natural flow on mobile to avoid nested scroll traps; bounded scroll on desktop */}
      <div
        ref={scrollContainerRef}
        className="md:max-h-[400px] md:overflow-y-auto md:pr-1 scroll-smooth"
        aria-live="polite"
        aria-label="Task discussion messages"
      >
        <TaskMessageList
          messages={messages}
          currentUserId={currentUserId}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
        />
      </div>

      {/* Composer — always visible even on completed tasks */}
      {user && (
        <TaskMessageComposer
          onSend={handleSend}
          isSending={isSending}
          currentUser={user}
          taskIsDone={taskIsDone}
        />
      )}
    </div>
  )
}
