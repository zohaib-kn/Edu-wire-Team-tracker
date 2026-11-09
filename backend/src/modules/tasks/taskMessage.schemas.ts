import { z } from 'zod'

export const createTaskMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body cannot be empty')
    .max(5000, 'Message body cannot exceed 5000 characters'),
  type: z.enum(['question', 'instruction', 'reply']),
})

export type CreateTaskMessageInput = z.infer<typeof createTaskMessageSchema>

export const getTaskMessagesQuerySchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export type GetTaskMessagesQueryInput = z.infer<typeof getTaskMessagesQuerySchema>
