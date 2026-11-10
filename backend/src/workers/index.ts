import type { Worker } from 'bullmq'
import '../models/index.js'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { closeRedisConnections } from '../config/redis.js'
import { createBaseWorker } from './base.worker.js'
import { QUEUE_NAMES } from '../queues/queue.config.js'
import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { expoService } from '../services/expo.service.js'
import { whatsappService } from '../services/whatsapp/whatsapp.service.js'
import { notificationScheduler } from '../schedulers/notification.scheduler.js'
import { deadlineNotificationService } from '../services/deadlineNotification.service.js'

const activeWorkers: Worker[] = []

/**
 * Core worker processor setup — shared by both startWorkers() and initWorkersInProcess().
 * Does NOT touch the database connection; caller is responsible for that.
 */
async function _initWorkerProcessors(): Promise<Worker[]> {
  // 1. Task Assignment Notification Worker
  const assignmentWorker = createBaseWorker({
    queueName: QUEUE_NAMES.TASK_ASSIGNMENT,
    processor: async (job) => {
      console.log(`[PROCESSOR: Assignment] Processing task assignment job: ${job.id}`, job.data)

      const {
        userId,
        recipient,
        taskId,
        notificationType,
        title,
        body,
        deepLink,
        due,
        priority,
      } = job.data || {}

      if (!userId) {
        return { success: false, reason: 'MISSING_USER_ID' }
      }

      const user = await User.findById(userId).exec()
      if (!user || !user.isActive) {
        await Notification.create({
          user: userId,
          type: notificationType || 'task_assigned',
          task: taskId || null,
          channel: 'web',
          status: 'skipped',
          recipient: recipient || 'unknown',
          error: 'USER_INACTIVE_OR_NOT_FOUND',
          jobId: job.id,
          idempotencyKey: job.opts.jobId || null,
        })
        return { success: true, status: 'skipped', reason: 'USER_INACTIVE' }
      }

      const pushTokens = user.pushTokens || []
      const idempotencyKey = job.opts.jobId || `assign_job:${job.id}`

      // Check if already dispatched (idempotency guard)
      const existingNotif = await Notification.findOne({ idempotencyKey }).exec()
      if (existingNotif && existingNotif.status === 'sent') {
        return { success: true, status: 'already_processed' }
      }

      // ── No push tokens: mobile app not registered yet ────────────────────
      // Save a 'web' channel notification so the record is preserved and
      // can be served by the future in-app notification endpoint.
      if (pushTokens.length === 0) {
        await Notification.create({
          user: user._id,
          type: notificationType || 'task_assigned',
          task: taskId || null,
          channel: 'web',
          status: 'queued', // 'queued' = waiting to be read via web UI, not skipped
          recipient: user.email,
          error: null,
          jobId: job.id,
          idempotencyKey,
          providerPayload: {
            title: title || 'New Task Assigned',
            body: body || 'You have been assigned a task.',
            deepLink,
            due,
            priority,
            type: notificationType,
          },
        })
        console.log(
          `[PROCESSOR: Assignment] 📬 Web notification queued for ${user.email} (no push tokens yet)`,
        )
        return { success: true, status: 'web_queued', reason: 'NO_PUSH_TOKENS' }
      }

      // ── Push tokens exist: dispatch via Expo ─────────────────────────────
      const pushResult = await expoService.sendPushNotification({
        to: pushTokens,
        userId: user._id.toString(),
        title: title || 'New Task Assigned',
        body: body || 'You have been assigned a task.',
        data: {
          taskId,
          due,
          priority,
          deepLink,
          type: notificationType,
        },
      })

      await Notification.create({
        user: user._id,
        type: notificationType || 'task_assigned',
        task: taskId || null,
        channel: 'push',
        status: pushResult.status,
        recipient: pushTokens[0] || user.email,
        sentAt: pushResult.accepted ? new Date() : null,
        error: pushResult.error || pushResult.skipReason || null,
        jobId: job.id,
        idempotencyKey,
        providerPayload: job.data,
      })

      return {
        success: pushResult.accepted,
        status: pushResult.status,
        ticketsCount: pushResult.ticketsCount,
        invalidTokensPruned: pushResult.invalidTokensPruned,
      }
    },
  })
  activeWorkers.push(assignmentWorker)

  // 2. Scheduled Reminders Worker (Due today, Late tasks)
  const reminderWorker = createBaseWorker({
    queueName: QUEUE_NAMES.TASK_REMINDERS,
    processor: async (job) => {
      console.log(`[PROCESSOR: Reminders] Processing reminder job: ${job.id}`, job.data)

      if (job.data?.type === 'due_today') {
        const res = await notificationScheduler.dispatchDueTodayReminders(job.data?.dateIST)
        return { success: true, jobType: 'due_today', ...res }
      }

      if (job.data?.type === 'overdue') {
        const res = await notificationScheduler.dispatchOverdueReminders(job.data?.dateIST)
        return { success: true, jobType: 'overdue', ...res }
      }

      if (job.data?.type === 'deadline_warning') {
        const res = await deadlineNotificationService.processDeadlineWarning(job.data)
        return { success: true, jobType: 'deadline_warning', ...res }
      }

      if (job.data?.type === 'deadline_escalation') {
        const res = await deadlineNotificationService.processDeadlineEscalation(job.data)
        return { success: true, jobType: 'deadline_escalation', ...res }
      }

      return { success: true, processedAt: new Date().toISOString() }
    },
  })
  activeWorkers.push(reminderWorker)

  // 3. WhatsApp Reports Worker (Daily pending, Weekly summary)
  const whatsappWorker = createBaseWorker({
    queueName: QUEUE_NAMES.WHATSAPP_REPORTS,
    processor: async (job) => {
      console.log(`[PROCESSOR: WhatsApp] Processing WhatsApp report job: ${job.id}`, job.data)

      if (job.data?.type === 'daily_pending') {
        const res = await notificationScheduler.dispatchDailyPendingReports(job.data?.dateIST)
        return { success: true, jobType: 'daily_pending', ...res }
      }

      if (job.data?.type === 'weekly_summary') {
        const res = await notificationScheduler.dispatchWeeklySummary(job.data?.dateIST)
        return { success: true, jobType: 'weekly_summary', ...res }
      }

      // Direct WhatsApp template job
      if (job.data?.recipient && job.data?.templateName) {
        const waResult = await whatsappService.sendTemplate({
          recipient: job.data.recipient,
          templateName: job.data.templateName,
          parameters: job.data.parameters || {},
          idempotencyKey: job.opts.jobId || `wa_job:${job.id}`,
        })
        return { success: waResult.accepted, ...waResult }
      }

      return { success: true, processedAt: new Date().toISOString() }
    },
  })
  activeWorkers.push(whatsappWorker)

  // 4. Push Notifications Worker
  const pushWorker = createBaseWorker({
    queueName: QUEUE_NAMES.PUSH_NOTIFICATIONS,
    processor: async (job) => {
      console.log(`[PROCESSOR: Push] Processing push notification job: ${job.id}`, job.data)

      if (job.data?.type === 'task_discussion_message' || job.data?.type === 'task_completed') {
        const notifType = job.data.type
        const { userId, taskId, messageId, to, recipient, title, body, deepLink } = job.data || {}
        const tokens = Array.isArray(to) ? to : to ? [to] : []
        const itemKey = messageId || taskId
        const idempotencyKey = job.opts.jobId || `push:${itemKey}:${userId}`

        if (tokens.length === 0) {
          await Notification.create({
            user: userId,
            type: notifType,
            task: taskId,
            channel: 'push',
            status: 'skipped',
            recipient: recipient || 'unknown',
            error: 'NO_PUSH_TOKENS',
            jobId: job.id,
            idempotencyKey: `push_skip:${itemKey}:${userId}`,
            providerPayload: job.data,
          })
          return { success: true, status: 'skipped', reason: 'NO_PUSH_TOKENS' }
        }

        const pushResult = await expoService.sendPushNotification({
          to: tokens,
          userId,
          title,
          body,
          data: { taskId, messageId, deepLink, type: notifType },
        })

        await Notification.create({
          user: userId,
          type: notifType,
          task: taskId,
          channel: 'push',
          status: pushResult.status,
          recipient: tokens[0] || recipient,
          sentAt: pushResult.accepted ? new Date() : null,
          error: pushResult.error || pushResult.skipReason || null,
          jobId: job.id,
          idempotencyKey,
          providerPayload: job.data,
        })

        return { success: pushResult.accepted, status: pushResult.status }
      }

      if (job.data?.to && job.data?.userId && job.data?.title) {
        const result = await expoService.sendPushNotification(job.data)
        return { success: result.accepted, ...result }
      }

      return { success: true, processedAt: new Date().toISOString() }
    },
  })
  activeWorkers.push(pushWorker)

  return activeWorkers
}

/**
 * Starts all workers as a standalone process.
 * Connects to MongoDB internally before initializing processors.
 * Use this when running workers as a separate process (e.g. `npx tsx src/workers/index.ts`).
 */
export async function startWorkers(): Promise<Worker[]> {
  console.log('====================================================')
  console.log('🚀 Starting Edu Wire Tracker Background Workers...')
  console.log('====================================================')

  await connectDatabase()
  const workers = await _initWorkerProcessors()
  console.log(`[WORKERS] ✅ All ${workers.length} workers initialized successfully.`)
  await deadlineNotificationService.reconcilePendingDeadlines().catch((err) => {
    console.warn('[WORKERS] Warning reconciling deadlines on standalone start:', err.message)
  })
  return workers
}

/**
 * Initializes workers in-process, reusing the caller's existing DB connection.
 * Use this from server.ts so workers run inside the same Node.js process as the API.
 * Does NOT call connectDatabase() — the caller must have already connected.
 */
export async function initWorkersInProcess(): Promise<Worker[]> {
  console.log('[WORKERS] 🔧 Initializing background workers in-process...')
  const workers = await _initWorkerProcessors()
  console.log(`[WORKERS] ✅ ${workers.length} in-process workers running.`)
  await deadlineNotificationService.reconcilePendingDeadlines().catch((err) => {
    console.warn('[WORKERS] Warning reconciling deadlines on in-process init:', err.message)
  })
  return workers
}

/**
 * Gracefully shuts down all active workers.
 * @param skipDbClose - Pass true when called from server.ts so the main
 *   server lifecycle handles the MongoDB disconnect (avoids double-close).
 */
export async function stopWorkers(skipDbClose = false): Promise<void> {
  console.log(`[WORKERS] Stopping ${activeWorkers.length} background workers...`)
  const closePromises = activeWorkers.map((w) => w.close())
  await Promise.allSettled(closePromises)
  activeWorkers.length = 0

  await closeRedisConnections()
  if (!skipDbClose) {
    await disconnectDatabase()
  }
  console.log('[WORKERS] ✅ All workers stopped cleanly.')
}

// When executed directly as a standalone process:
if (process.argv[1]?.endsWith('workers/index.ts') || process.argv[1]?.endsWith('workers\\index.ts')) {
  startWorkers().catch((err) => {
    console.error('[WORKERS] ❌ Fatal error starting workers:', err)
    process.exit(1)
  })

  const shutdown = async (signal: string) => {
    console.log(`\n[WORKERS] ${signal} received. Initiating graceful shutdown...`)
    await stopWorkers()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}
