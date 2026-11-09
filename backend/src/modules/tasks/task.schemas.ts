import { z } from 'zod'

export const subtaskInputSchema = z.object({
  title: z
    .string()
    .min(1, 'Subtask title is required')
    .trim(),
  owner: z
    .string()
    .min(1, 'Assigned owner is required')
    .trim(),
  responsibilityLabel: z
    .string()
    .trim()
    .optional(),
  note: z
    .string()
    .trim()
    .optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .optional(),
  priority: z
    .enum(['normal', 'high'])
    .optional(),
  isRequired: z
    .boolean()
    .optional(),
})

export type SubtaskInput = z.infer<typeof subtaskInputSchema>

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Task title is required')
      .trim(),
    team: z
      .string()
      .min(1, 'Team is required')
      .trim(),
    branch: z
      .string()
      .trim()
      .optional(),
    owner: z
      .string()
      .trim()
      .optional(),
    reportingManager: z
      .string()
      .trim()
      .optional(),
    due: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
    priority: z
      .enum(['normal', 'high'])
      .default('normal'),
    note: z
      .string()
      .trim()
      .optional(),
    responsibilityLabel: z
      .string()
      .trim()
      .optional(),
    isRequired: z
      .boolean()
      .optional(),
    parentTask: z
      .string()
      .trim()
      .optional(),
    subtasks: z
      .array(subtaskInputSchema)
      .min(1, 'At least one subtask is required when providing subtasks')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.subtasks && data.subtasks.length > 0) {
        return true
      }
      return typeof data.owner === 'string' && data.owner.trim().length > 0
    },
    {
      message: 'Assigned owner is required for standalone tasks',
      path: ['owner'],
    },
  )

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const createSubtaskSchema = subtaskInputSchema
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .trim()
    .optional(),
  note: z
    .string()
    .trim()
    .optional(),
  owner: z
    .string()
    .min(1, 'Owner cannot be empty')
    .trim()
    .optional(),
  reportingManager: z
    .string()
    .trim()
    .optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .optional(),
  priority: z
    .enum(['normal', 'high'])
    .optional(),
  responsibilityLabel: z
    .string()
    .trim()
    .optional(),
  isRequired: z
    .boolean()
    .optional(),
})

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

export const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'doing', 'done']),
})

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>

export const taskQuerySchema = z.object({
  team: z.string().optional(),
  branch: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done', 'all', 'pending', 'completed']).optional(),
  owner: z.string().optional(),
  reporting: z.enum(['me']).optional(),
  reportingManager: z.string().optional(),
  due: z.enum(['late', 'today', 'all']).optional(),
  parentTask: z.string().optional(),
  taskLevel: z.enum(['parent', 'subtask', 'standalone', 'all']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export type TaskQueryInput = z.infer<typeof taskQuerySchema>

