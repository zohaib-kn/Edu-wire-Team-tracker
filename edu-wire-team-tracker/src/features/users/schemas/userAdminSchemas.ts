import { z } from 'zod'

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Full name is required')
    .max(120, 'Name must be 120 characters or fewer')
    .trim(),
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address')
    .trim(),
  phone: z
    .string()
    .optional(),
  role: z
    .string()
    .min(1, 'Role selection is required')
    .trim(),
  branch: z
    .string()
    .min(1, 'Branch selection is required')
    .trim(),
  teams: z
    .array(z.string())
    .optional(),
  temporaryPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number'),
})

export type CreateUserFormValues = z.infer<typeof createUserSchema>

export const editUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Full name is required')
    .max(120, 'Name must be 120 characters or fewer')
    .trim(),
  phone: z
    .string()
    .optional(),
  role: z
    .string()
    .min(1, 'Role selection is required')
    .trim(),
  branch: z
    .string()
    .min(1, 'Branch selection is required')
    .trim(),
  teams: z
    .array(z.string())
    .optional(),
})

export type EditUserFormValues = z.infer<typeof editUserSchema>
