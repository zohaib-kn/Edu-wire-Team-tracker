import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(255, 'Title must be 255 characters or fewer')
    .trim(),
  branch: z
    .string()
    .trim()
    .optional(),
  team: z
    .string()
    .min(1, 'Please select a team')
    .trim(),
  owner: z
    .string()
    .min(1, 'Please select an assigned owner')
    .trim(),
  reportingManager: z
    .string()
    .trim()
    .optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid due date (YYYY-MM-DD)'),
  priority: z.enum(['normal', 'high'], {
    message: 'Priority must be either normal or high',
  }),
  note: z.string().optional(),
})

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>

export const editTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(255, 'Title must be 255 characters or fewer')
    .trim(),
  branch: z
    .string()
    .trim()
    .optional(),
  team: z
    .string()
    .trim()
    .optional(),
  owner: z
    .string()
    .min(1, 'Please select an assigned owner')
    .trim(),
  reportingManager: z
    .string()
    .trim()
    .optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid due date (YYYY-MM-DD)'),
  priority: z.enum(['normal', 'high'], {
    message: 'Priority must be either normal or high',
  }),
  note: z.string().optional(),
})

export type EditTaskFormValues = z.infer<typeof editTaskSchema>
