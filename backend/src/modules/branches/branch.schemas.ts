import { z } from 'zod'

export const createBranchSchema = z.object({
  name: z
    .string()
    .min(1, 'Branch name is required')
    .max(100, 'Branch name must be 100 characters or fewer')
    .trim(),
  city: z
    .string()
    .min(1, 'City is required')
    .max(100, 'City must be 100 characters or fewer')
    .trim(),
  isActive: z.boolean().optional().default(true),
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>

export const updateBranchSchema = z.object({
  name: z
    .string()
    .min(1, 'Branch name cannot be empty')
    .max(100, 'Branch name must be 100 characters or fewer')
    .trim()
    .optional(),
  city: z
    .string()
    .min(1, 'City cannot be empty')
    .max(100, 'City must be 100 characters or fewer')
    .trim()
    .optional(),
  isActive: z.boolean().optional(),
})

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>

