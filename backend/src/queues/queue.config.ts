import type { DefaultJobOptions, WorkerOptions } from 'bullmq'

export const QUEUE_NAMES = {
  TASK_ASSIGNMENT: 'task-assignment',
  TASK_REMINDERS: 'task-reminders',
  WHATSAPP_REPORTS: 'whatsapp-reports',
  PUSH_NOTIFICATIONS: 'push-notifications',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

/**
 * Standard retry and retention configuration for BullMQ queues.
 */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600, // keep completed for 24h
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600, // keep failed for 7 days
  },
}

/**
 * Default worker concurrency and lock configuration.
 */
export const DEFAULT_WORKER_OPTIONS: Partial<WorkerOptions> = {
  concurrency: 5,
  lockDuration: 30000,
  maxStalledCount: 2,
}

