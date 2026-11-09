import { useCallback } from 'react'
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

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useTaskMessages(taskId)

  const { mutateAsync: postMessage, isPending: isSending } = usePostTaskMessage(taskId)

  const handleSend = useCallback(
    async (body: string, type: TaskMessageType) => {
      if (!body.trim()) return
      await postMessage({ body: body.trim(), type })
      toast.success('Message sent')
    },
    [postMessage],
  )

  const messages = data?.messages ?? []
  const currentUserId = user?.id ?? ''

  return (
    <div className="flex flex-col gap-4">
      {/* Message list with auto-scroll */}
      <div
        className="max-h-[420px] overflow-y-auto pr-1 scroll-smooth"
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

