import { z } from 'zod'

export const createTeamSchema = z.object({
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
    .trim()
    .optional(),
  isActive: z.boolean().optional().default(true),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>

export const updateTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name cannot be empty')
    .max(100, 'Team name must be 100 characters or fewer')
    .trim()
    .optional(),
  branch: z
    .string()
    .min(1, 'Branch selection is required')
    .trim()
    .optional(),
  lead: z
    .string()
    .trim()
    .optional(),
  isActive: z.boolean().optional(),
})

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>

