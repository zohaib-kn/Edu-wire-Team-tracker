import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Load backend/.env explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val.trim() === '') return undefined
      const normalized = val.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
      if (/^\d+$/.test(normalized)) return Number(normalized)
      return val.trim()
    }),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required. Configure your MongoDB connection string in backend/.env'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),
  USE_MOCK_REDIS: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('====================================================')
    console.error('❌ FATAL: Backend Environment Configuration Error')
    console.error('====================================================')
    const errors = result.error.format()
    for (const [key, value] of Object.entries(errors)) {
      if (key !== '_errors' && value && '_errors' in value && Array.isArray(value._errors)) {
        console.error(`  • ${key}: ${value._errors.join(', ')}`)
      }
    }
    console.error('Please check your backend/.env file and ensure all required variables are set.')
    console.error('====================================================')
    process.exit(1)
  }

  return result.data
}

export const env = loadEnv()

