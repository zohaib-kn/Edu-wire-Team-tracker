import { Worker, type Processor, type WorkerOptions } from 'bullmq'
import { createRedisClient, isRedisMockEnabled } from '../config/redis.js'
import { DEFAULT_WORKER_OPTIONS, type QueueName } from '../queues/queue.config.js'
import { mockWorkersRegistry } from '../queues/mock.queue.js'

export interface CreateWorkerParams<T = any, R = any> {
  queueName: QueueName | string
  processor: Processor<T, R>
  options?: Partial<WorkerOptions>
}

/**
 * Creates a BullMQ worker with standard error handling, concurrency, and lifecycle logging.
 */
export function createBaseWorker<T = any, R = any>({
  queueName,
  processor,
  options = {},
}: CreateWorkerParams<T, R>): Worker<T, R> {
  if (isRedisMockEnabled()) {
    const handler = async (job: any) => {
      try {
        await (processor as Function)(job)
      } catch (err: any) {
        console.error(`[MOCK_WORKER: ${queueName}] Job ${job.id} failed:`, err.message)
      }
    }

    const existingList = mockWorkersRegistry.get(queueName) || []
    existingList.push(handler)
    mockWorkersRegistry.set(queueName, existingList)

    const mockWorker: any = {
      name: queueName,
      async close() {
        const list = mockWorkersRegistry.get(queueName) || []
        const idx = list.indexOf(handler)
        if (idx !== -1) list.splice(idx, 1)
      },
      on() {
        return this
      },
    }
    return mockWorker as Worker<T, R>
  }

  const connection = createRedisClient()

  const worker = new Worker<T, R>(queueName, processor, {
    connection: connection as any,
    ...DEFAULT_WORKER_OPTIONS,
    ...options,
  })

  worker.on('ready', () => {
    console.log(`[WORKER: ${queueName}] 🟢 Worker ready and listening for jobs`)
  })

  worker.on('completed', (job) => {
    console.log(`[WORKER: ${queueName}] ✅ Job ${job.id} (${job.name}) completed successfully`)
  })

  worker.on('failed', (job, err) => {
    const attemptsMade = job ? job.attemptsMade : 0
    const maxAttempts = job?.opts?.attempts || 1
    console.error(
      `[WORKER: ${queueName}] ❌ Job ${job?.id} (${job?.name}) failed (attempt ${attemptsMade}/${maxAttempts}): ${err.message}`,
    )
  })

  worker.on('error', (err) => {
    console.error(`[WORKER: ${queueName}] ⚠️  Worker runtime error:`, err.message)
  })

  return worker
}
