import { z } from 'zod'

export const subtaskItemFormSchema = z.object({
  owner: z.string().min(1, 'Please select an assigned member').trim(),
  responsibilityLabel: z.string().trim().optional(),
  title: z.string().min(1, 'Subtask title is required').trim(),
  note: z.string().trim().optional(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid due date (YYYY-MM-DD)'),
  priority: z.enum(['normal', 'high']),
  isRequired: z.boolean().default(true),
})

export type SubtaskFormValues = z.infer<typeof subtaskItemFormSchema>

export const createTaskSchema = z
  .object({
    mode: z.enum(['single', 'multiple']).default('single'),
    title: z
      .string()
      .min(1, 'Task title is required')
      .max(255, 'Title must be 255 characters or fewer')
      .trim(),
    branch: z.string().trim().optional(),
    team: z.string().min(1, 'Please select a team').trim(),
    owner: z.string().trim().optional(),
    reportingManager: z.string().trim().optional(),
    due: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid due date (YYYY-MM-DD)'),
    priority: z.enum(['normal', 'high'], {
      message: 'Priority must be either normal or high',
    }),
    note: z.string().optional(),
    subtasks: z.array(subtaskItemFormSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'single') {
      if (!data.owner || !data.owner.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please select an assigned owner',
          path: ['owner'],
        })
      }
    } else if (data.mode === 'multiple') {
      if (!data.subtasks || data.subtasks.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please add at least one member assignment',
          path: ['subtasks'],
        })
      } else {
        const seenOwners = new Set<string>()
        data.subtasks.forEach((st, idx) => {
          if (!st.owner || !st.owner.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Please select an assigned member',
              path: ['subtasks', idx, 'owner'],
            })
          } else if (seenOwners.has(st.owner.toLowerCase())) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Duplicate assignees are not allowed under the same parent task',
              path: ['subtasks', idx, 'owner'],
            })
          } else {
            seenOwners.add(st.owner.toLowerCase())
          }

          if (!st.title || !st.title.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Subtask title is required',
              path: ['subtasks', idx, 'title'],
            })
          }
        })
      }
    }
  })

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>

export const editTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(255, 'Title must be 255 characters or fewer')
    .trim(),
  branch: z.string().trim().optional(),
  team: z.string().trim().optional(),
  owner: z.string().min(1, 'Please select an assigned owner').trim(),
  reportingManager: z.string().trim().optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid due date (YYYY-MM-DD)'),
  priority: z.enum(['normal', 'high'], {
    message: 'Priority must be either normal or high',
  }),
  note: z.string().optional(),
  responsibilityLabel: z.string().trim().optional(),
})

export type EditTaskFormValues = z.infer<typeof editTaskSchema>

export const addSubtaskSchema = z.object({
  title: z.string().min(1, 'Subtask title is required').trim(),
  owner: z.string().min(1, 'Please select an assigned member').trim(),
  responsibilityLabel: z.string().trim().optional(),
  note: z.string().trim().optional(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a valid due date (YYYY-MM-DD)'),
  priority: z.enum(['normal', 'high']).default('normal'),
  isRequired: z.boolean().default(true),
})

export type AddSubtaskFormValues = z.infer<typeof addSubtaskSchema>
