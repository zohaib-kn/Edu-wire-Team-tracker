import { z } from 'zod'

export const branchSchema = z.object({
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
  isActive: z.boolean().optional(),
})

export type BranchFormValues = z.infer<typeof branchSchema>

export const teamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be 100 characters or fewer')
    .trim(),
  branch: z
    .string()
    .min(1, 'Branch selection is required')
    .trim(),
  lead: z
    .string()
    .optional(),
  isActive: z.boolean().optional(),
})

export type TeamFormValues = z.infer<typeof teamSchema>
