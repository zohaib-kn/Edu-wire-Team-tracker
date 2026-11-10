import { DEFAULT_JOB_OPTIONS, type QueueName } from './queue.config.js'

export interface MockJob<T = any> {
  id: string
  name: string
  data: T
  opts: Record<string, any>
  attemptsMade: number
  timestamp: number
  remove: () => Promise<void>
}

// Registry to link mock workers to mock queues
export const mockWorkersRegistry = new Map<string, Array<(job: MockJob) => Promise<any>>>()

export class MockQueue {
  readonly name: string
  private jobs = new Map<string, MockJob>()
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(name: QueueName | string) {
    this.name = name
  }

  async add<T = any>(jobName: string, data: T, opts: any = {}): Promise<MockJob<T>> {
    const id = opts?.jobId || `mock_job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Deduplication check for idempotent job keys
    if (opts?.jobId && this.jobs.has(opts.jobId)) {
      return this.jobs.get(opts.jobId)!
    }

    const job: MockJob<T> = {
      id,
      name: jobName,
      data,
      opts: { ...DEFAULT_JOB_OPTIONS, ...opts },
      attemptsMade: 0,
      timestamp: Date.now(),
      remove: async () => {
        const timer = this.timers.get(id)
        if (timer) {
          clearTimeout(timer)
          this.timers.delete(id)
        }
        this.jobs.delete(id)
      },
    }

    this.jobs.set(id, job)

    const delay = typeof opts?.delay === 'number' && opts.delay > 0 ? opts.delay : 0

    // Trigger registered mock worker handlers after delay (or immediately on next tick)
    const timer = setTimeout(() => {
      this.timers.delete(id)
      if (!this.jobs.has(id)) return // cancelled or removed

      const workerHandlers = mockWorkersRegistry.get(this.name) || []
      for (const handler of workerHandlers) {
        handler(job).catch((err) => {
          console.error(`[MOCK_WORKER: ${this.name}] Job ${job.id} handler error:`, err)
        })
      }
    }, delay)

    this.timers.set(id, timer)

    return job
  }

  async getJob(jobId: string): Promise<MockJob | null> {
    return this.jobs.get(jobId) || null
  }

  /**
   * For tests: manually executes a queued/delayed job immediately regardless of delay.
   */
  async triggerJobNow(jobId: string): Promise<any> {
    const job = this.jobs.get(jobId)
    if (!job) return null

    const timer = this.timers.get(jobId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(jobId)
    }

    const workerHandlers = mockWorkersRegistry.get(this.name) || []
    const results = []
    for (const handler of workerHandlers) {
      results.push(await handler(job))
    }
    return results[0]
  }

  async drain(): Promise<void> {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.jobs.clear()
  }

  async close(): Promise<void> {
    await this.drain()
  }

  on(_event: string, _callback: Function): this {
    return this
  }
}
