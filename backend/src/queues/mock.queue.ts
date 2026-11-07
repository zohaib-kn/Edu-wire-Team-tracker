import { DEFAULT_JOB_OPTIONS, type QueueName } from './queue.config.js'

export interface MockJob<T = any> {
  id: string
  name: string
  data: T
  opts: Record<string, any>
  attemptsMade: number
  timestamp: number
}

// Registry to link mock workers to mock queues
export const mockWorkersRegistry = new Map<string, Array<(job: MockJob) => Promise<any>>>()

export class MockQueue {
  readonly name: string
  private jobs = new Map<string, MockJob>()

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
    }

    this.jobs.set(id, job)

    // Trigger registered mock worker if present
    const workerHandlers = mockWorkersRegistry.get(this.name) || []
    for (const handler of workerHandlers) {
      setTimeout(() => {
        handler(job).catch((err) => {
          console.error(`[MOCK_WORKER: ${this.name}] Job ${job.id} handler error:`, err)
        })
      }, 0)
    }

    return job
  }

  async getJob(jobId: string): Promise<MockJob | null> {
    return this.jobs.get(jobId) || null
  }

  async drain(): Promise<void> {
    this.jobs.clear()
  }

  async close(): Promise<void> {
    this.jobs.clear()
  }

  on(_event: string, _callback: Function): this {
    return this
  }
}

