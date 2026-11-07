import { z } from 'zod'

export const registerDeviceSchema = z.object({
  token: z
    .string()
    .min(1, 'Device push token is required')
    .trim(),
})

export const unregisterDeviceSchema = z.object({
  token: z
    .string()
    .min(1, 'Device push token is required')
    .trim(),
})

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

