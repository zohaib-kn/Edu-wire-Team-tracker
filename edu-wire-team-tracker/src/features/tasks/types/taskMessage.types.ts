export type TaskMessageType = 'question' | 'instruction' | 'reply'

export interface TaskMessageSender {
  id: string
  name: string
  role: string
}

export interface TaskMessage {
  id: string
  taskId: string
  sender: TaskMessageSender
  type: TaskMessageType
  body: string
  createdAt: string
  updatedAt: string
}

export interface TaskMessagesResponse {
  messages: TaskMessage[]
  data?: TaskMessage[]
  total: number
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

export interface CreateTaskMessagePayload {
  body: string
  type: TaskMessageType
}

