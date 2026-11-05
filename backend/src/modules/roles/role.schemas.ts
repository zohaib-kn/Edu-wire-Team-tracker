import { z } from 'zod'

export const SYSTEM_PERMISSION_KEYS = [
  'task.view',
  'task.create',
  'task.edit',
  'task.status',
  'task.delete',
  'report.view',
  'user.manage',
  'team.manage',
  'branch.manage',
  'role.manage',
] as const

export const ALLOWED_SCOPES = ['none', 'own', 'team', 'branch', 'all'] as const

export const rolePermissionConfigSchema = z.object({
  permission: z.string().trim().refine((val) => SYSTEM_PERMISSION_KEYS.includes(val as any), {
    message: 'Invalid system permission key',
  }),
  scope: z.enum(ALLOWED_SCOPES),
})

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name must be 50 characters or fewer')
    .trim(),
  description: z.string().trim().optional().default(''),
  permissions: z.array(rolePermissionConfigSchema).optional().default([]),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name cannot be empty')
    .max(50, 'Role name must be 50 characters or fewer')
    .trim()
    .optional(),
  description: z.string().trim().optional(),
  permissions: z.array(rolePermissionConfigSchema),
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

