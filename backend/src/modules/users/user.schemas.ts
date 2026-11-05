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
    .trim()
    .toLowerCase(),
  phone: z
    .string()
    .trim()
    .optional()
    .default(''),
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
    .optional()
    .default([]),
  temporaryPassword: z
    .string()
    .min(8, 'Temporary password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number')
    .optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Full name is required')
    .max(120, 'Name must be 120 characters or fewer')
    .trim()
    .optional(),
  phone: z
    .string()
    .trim()
    .optional(),
  role: z
    .string()
    .min(1, 'Role selection is required')
    .trim()
    .optional(),
  branch: z
    .string()
    .min(1, 'Branch selection is required')
    .trim()
    .optional(),
  teams: z
    .array(z.string())
    .optional(),
  isActive: z
    .boolean()
    .optional(),
  status: z
    .enum(['active', 'inactive', 'locked'])
    .optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const userQuerySchema = z.object({
  q: z.string().optional(),
  branch: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export type UserQueryInput = z.infer<typeof userQuerySchema>

