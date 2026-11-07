import { Queue, type JobsOptions } from 'bullmq'
import { getSharedRedisConnection, isRedisMockEnabled } from '../config/redis.js'
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  type QueueName,
} from './queue.config.js'
import { MockQueue } from './mock.queue.js'

// Cache queues to avoid duplicate queue instances and connection leaks
const queuesMap = new Map<string, Queue>()

/**
 * Returns or initializes a typed BullMQ queue instance.
 */
export function getQueue(queueName: QueueName | string): Queue {
  if (queuesMap.has(queueName)) {
    return queuesMap.get(queueName)!
  }

  if (isRedisMockEnabled()) {
    const mockQueue = new MockQueue(queueName) as unknown as Queue
    queuesMap.set(queueName, mockQueue)
    return mockQueue
  }

  const connection = getSharedRedisConnection()

  const queue = new Queue(queueName, {
    connection: connection as any,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  })

  queue.on('error', (err) => {
    console.error(`[QUEUE: ${queueName}] ❌ Queue error:`, err.message)
  })

  queuesMap.set(queueName, queue)
  return queue
}

// Convenience accessors for the 4 core business queues
export const getTaskAssignmentQueue = () => getQueue(QUEUE_NAMES.TASK_ASSIGNMENT)
export const getTaskRemindersQueue = () => getQueue(QUEUE_NAMES.TASK_REMINDERS)
export const getWhatsappReportsQueue = () => getQueue(QUEUE_NAMES.WHATSAPP_REPORTS)
export const getPushNotificationsQueue = () => getQueue(QUEUE_NAMES.PUSH_NOTIFICATIONS)

/**
 * Enqueues a job with idempotent deduplication and retry defaults.
 */
export async function enqueueJob<T = any>(
  queueName: QueueName | string,
  jobName: string,
  data: T,
  options?: JobsOptions,
) {
  const queue = getQueue(queueName)
  const job = await queue.add(jobName, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  })
  return job
}

/**
 * Gracefully shuts down all open queue instances.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = []
  for (const [name, q] of queuesMap.entries()) {
    closePromises.push(
      q.close().catch((err) => {
        console.warn(`[QUEUE: ${name}] Warning while closing:`, err.message)
      }),
    )
  }
  await Promise.allSettled(closePromises)
  queuesMap.clear()
}

