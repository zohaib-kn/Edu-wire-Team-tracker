import mongoose from 'mongoose'
import { Task, type ITask } from '../models/Task.js'
import { User, type IUser } from '../models/User.js'
import { Notification } from '../models/Notification.js'
import { notificationService } from './notification.service.js'
import { expoService } from './expo.service.js'
import { getTaskRemindersQueue, enqueueJob } from '../queues/queue.manager.js'
import { QUEUE_NAMES } from '../queues/queue.config.js'

export interface DeadlineJobData {
  type: 'deadline_warning' | 'deadline_escalation'
  taskId: string
  deadlineAt: string
  deadlineTimezone?: string
  reminderMinutesBefore?: number
}

export const deadlineNotificationService = {
  /**
   * Generates stable job IDs for delayed BullMQ deadline reminders.
   */
  getWarningJobId(taskId: string, deadlineTimestamp: number): string {
    return `deadline:warning:${taskId}:${deadlineTimestamp}`
  },

  getEscalationJobId(taskId: string, deadlineTimestamp: number): string {
    return `deadline:escalation:${taskId}:${deadlineTimestamp}`
  },

  /**
   * Schedules delayed advance warning and deadline-reached escalation jobs for an actionable task.
   */
  async scheduleTaskDeadlineJobs(task: any): Promise<void> {
    // 1. Guard against parent coordination containers, completed tasks, and untimed tasks
    if (!task || task.taskLevel === 'parent' || task.status === 'done' || !task.deadlineAt) {
      return
    }

    const taskId = (task._id || task.id).toString()
    const deadlineDate = new Date(task.deadlineAt)
    if (isNaN(deadlineDate.getTime())) {
      return
    }

    const now = Date.now()
    const deadlineMs = deadlineDate.getTime()

    // If deadline is already in the past, do not schedule future alerts
    if (deadlineMs <= now) {
      return
    }

    const remindersQueue = getTaskRemindersQueue()
    const tz = task.deadlineTimezone || 'Asia/Kolkata'

    // 2. Schedule Advance Warning (e.g. 30 or 60 minutes before)
    // If reminderMinutesBefore is explicitly null or <= 0, no advance reminder
    const hasAdvanceReminder =
      task.reminderMinutesBefore !== null &&
      task.reminderMinutesBefore !== 0 &&
      task.reminderMinutesBefore !== undefined
    const minutesBefore =
      typeof task.reminderMinutesBefore === 'number'
        ? task.reminderMinutesBefore
        : 30 // default 30 minutes when not set to null

    if (hasAdvanceReminder && minutesBefore > 0) {
      const advanceMs = deadlineMs - minutesBefore * 60 * 1000
      const warningDelay = Math.max(0, advanceMs - now)
      const warningJobId = this.getWarningJobId(taskId, deadlineMs)

      // Only schedule if warning instant hasn't passed, OR if task is created/edited < 30 mins from deadline
      if (now < deadlineMs) {
        const warningData: DeadlineJobData = {
          type: 'deadline_warning',
          taskId,
          deadlineAt: deadlineDate.toISOString(),
          deadlineTimezone: tz,
          reminderMinutesBefore: minutesBefore,
        }

        try {
          await remindersQueue.add(warningJobId, warningData, {
            jobId: warningJobId,
            delay: warningDelay,
          })
        } catch (queueErr: any) {
          console.warn(`[DEADLINE_SCHEDULER] Warning enqueue failed for ${taskId}:`, queueErr.message)
        }
      }
    }

    // 3. Schedule Deadline-Reached Escalation Job (at exact deadline instant)
    const escalationDelay = Math.max(0, deadlineMs - now)
    const escalationJobId = this.getEscalationJobId(taskId, deadlineMs)
    const escalationData: DeadlineJobData = {
      type: 'deadline_escalation',
      taskId,
      deadlineAt: deadlineDate.toISOString(),
      deadlineTimezone: tz,
    }

    try {
      await remindersQueue.add(escalationJobId, escalationData, {
        jobId: escalationJobId,
        delay: escalationDelay,
      })
    } catch (queueErr: any) {
      console.warn(`[DEADLINE_SCHEDULER] Escalation enqueue failed for ${taskId}:`, queueErr.message)
    }
  },

  /**
   * Cancels scheduled delayed deadline jobs for a task (e.g. when completed, deleted, or rescheduled).
   */
  async cancelTaskDeadlineJobs(taskId: string, deadlineAt?: Date | string | null): Promise<void> {
    if (!taskId) return

    try {
      const queue = getTaskRemindersQueue()

      if (deadlineAt) {
        const d = new Date(deadlineAt)
        if (!isNaN(d.getTime())) {
          const ms = d.getTime()
          const warningJobId = this.getWarningJobId(taskId, ms)
          const escalationJobId = this.getEscalationJobId(taskId, ms)

          const warnJob = await queue.getJob(warningJobId)
          if (warnJob && typeof warnJob.remove === 'function') {
            await warnJob.remove()
          }

          const escJob = await queue.getJob(escalationJobId)
          if (escJob && typeof escJob.remove === 'function') {
            await escJob.remove()
          }
        }
      }
    } catch (err: any) {
      console.warn(`[DEADLINE_SCHEDULER] Cancel jobs warning for task ${taskId}:`, err.message)
    }
  },

  /**
   * Handles task rescheduling: cancels old jobs and schedules new ones.
   */
  async handleTaskDeadlineRescheduled(
    task: any,
    oldDeadlineAt?: Date | string | null,
  ): Promise<void> {
    const taskId = (task._id || task.id).toString()
    await this.cancelTaskDeadlineJobs(taskId, oldDeadlineAt)
    await this.scheduleTaskDeadlineJobs(task)
  },

  /**
   * Handles task completion: suppresses pending jobs.
   */
  async handleTaskCompleted(task: any): Promise<void> {
    const taskId = (task._id || task.id).toString()
    await this.cancelTaskDeadlineJobs(taskId, task.deadlineAt)
  },

  /**
   * Handles task reopening: reschedules deadline alerts if deadline is still in future.
   */
  async handleTaskReopened(task: any): Promise<void> {
    await this.scheduleTaskDeadlineJobs(task)
  },

  /**
   * Worker processor: 30-minute Advance Warning with 8-step safety verification.
   */
  async processDeadlineWarning(jobData: DeadlineJobData): Promise<any> {
    const { taskId, deadlineAt, reminderMinutesBefore = 30 } = jobData

    // 1. Reload latest Task document
    const task = await Task.findById(taskId).populate('owner').exec()

    // 2. Verify task exists
    if (!task) {
      return { success: false, reason: 'TASK_NOT_FOUND' }
    }

    // 3. Verify not soft-deleted
    if (task.deletedAt !== null) {
      return { success: true, status: 'skipped', reason: 'TASK_DELETED' }
    }

    // 4. Verify status is todo or doing (suppress if already done)
    if (task.status === 'done') {
      return { success: true, status: 'skipped', reason: 'TASK_ALREADY_DONE' }
    }

    // 5. Verify deadline has not changed
    if (!task.deadlineAt) {
      return { success: true, status: 'skipped', reason: 'DEADLINE_REMOVED' }
    }

    const currentDeadlineMs = new Date(task.deadlineAt).getTime()
    const expectedDeadlineMs = new Date(deadlineAt).getTime()
    if (Math.abs(currentDeadlineMs - expectedDeadlineMs) > 1000) {
      return { success: true, status: 'skipped', reason: 'DEADLINE_CHANGED' }
    }

    // 6. Verify recipient is eligible and active
    const rawOwner = task.owner as unknown as IUser & { _id: mongoose.Types.ObjectId }
    if (!rawOwner || !rawOwner.isActive) {
      return { success: true, status: 'skipped', reason: 'OWNER_INACTIVE' }
    }

    // 7. Verify this reminder has not already been processed (Idempotency)
    const idempotencyKey = `web:deadline_warning:${task._id}:${expectedDeadlineMs}:${rawOwner._id}`
    const existing = await Notification.findOne({ idempotencyKey }).exec()
    if (existing && (existing.status === 'queued' || existing.status === 'sent')) {
      return { success: true, status: 'already_processed' }
    }

    // 8. Create notification record and deliver through configured channels
    const title = 'Task Deadline Warning'
    const body = `Only ${reminderMinutesBefore} minutes left to complete "${task.title}".`
    const deepLink = `edutracker://tasks/${task._id}`

    // Durable web notification
    await Notification.create({
      user: rawOwner._id,
      type: 'deadline_warning',
      task: task._id,
      channel: 'web',
      status: 'queued',
      recipient: rawOwner.email || 'web',
      idempotencyKey,
      providerPayload: {
        title,
        body,
        taskId: task._id.toString(),
        taskTitle: task.title,
        deadlineAt: task.deadlineAt.toISOString(),
        deadlineTimezone: task.deadlineTimezone || 'Asia/Kolkata',
        reminderMinutesBefore,
        deepLink,
        type: 'deadline_warning',
      },
    })

    // Push notification if tokens exist
    const pushTokens = rawOwner.pushTokens || []
    if (pushTokens.length > 0) {
      try {
        await enqueueJob(
          QUEUE_NAMES.PUSH_NOTIFICATIONS,
          `push:deadline_warning:${task._id}:${rawOwner._id}`,
          {
            type: 'deadline_warning',
            userId: rawOwner._id.toString(),
            recipient: rawOwner.email,
            taskId: task._id.toString(),
            title,
            body,
            to: pushTokens,
            deepLink,
          },
          {
            jobId: `push:deadline_warning:${task._id}:${rawOwner._id}:${Date.now()}`,
          },
        )
      } catch (pushErr: any) {
        console.warn(`[DEADLINE_WARNING] Push enqueue warning:`, pushErr.message)
      }
    }

    console.log(`[DEADLINE_WARNING] ⚠️ Advance warning delivered for task "${task.title}" to ${rawOwner.email}`)
    return { success: true, status: 'delivered', recipient: rawOwner.email }
  },

  /**
   * Worker processor: Deadline-Reached Escalation targeting Task Owner & Reporting Manager.
   */
  async processDeadlineEscalation(jobData: DeadlineJobData): Promise<any> {
    const { taskId, deadlineAt } = jobData

    // 1. Reload latest Task document
    const task = await Task.findById(taskId).populate('owner').populate('reportingManager').exec()

    // 2. Verify task exists
    if (!task) {
      return { success: false, reason: 'TASK_NOT_FOUND' }
    }

    // 3. Verify not soft-deleted
    if (task.deletedAt !== null) {
      return { success: true, status: 'skipped', reason: 'TASK_DELETED' }
    }

    // 4. Verify status is todo or doing (do not escalate if already done)
    if (task.status === 'done') {
      return { success: true, status: 'skipped', reason: 'TASK_ALREADY_DONE' }
    }

    // 5. Verify deadline has not changed
    if (!task.deadlineAt) {
      return { success: true, status: 'skipped', reason: 'DEADLINE_REMOVED' }
    }

    const currentDeadlineMs = new Date(task.deadlineAt).getTime()
    const expectedDeadlineMs = new Date(deadlineAt).getTime()
    if (Math.abs(currentDeadlineMs - expectedDeadlineMs) > 1000) {
      return { success: true, status: 'skipped', reason: 'DEADLINE_CHANGED' }
    }

    // 6. Server-side Recipient Resolution
    const owner = task.owner as unknown as IUser & { _id: mongoose.Types.ObjectId }
    const { manager } = await notificationService.resolveReportingManager(task)

    const ownerIdStr = owner ? owner._id.toString() : null
    const managerIdStr = manager ? manager._id.toString() : null
    const isSameUser = ownerIdStr && managerIdStr && ownerIdStr === managerIdStr

    const deepLink = `edutracker://tasks/${task._id}`
    const results: Record<string, string> = {}

    // 6a. Notify Task Owner
    if (owner && owner.isActive) {
      const ownerIdempotencyKey = `web:deadline_escalation:${task._id}:${expectedDeadlineMs}:${owner._id}`
      const existingOwnerNotif = await Notification.findOne({ idempotencyKey: ownerIdempotencyKey }).exec()

      if (!existingOwnerNotif) {
        const ownerTitle = 'Deadline Reached'
        const ownerBody = 'Your task deadline has been reached. Please complete the task or provide a progress update.'

        await Notification.create({
          user: owner._id,
          type: 'deadline_escalation',
          task: task._id,
          channel: 'web',
          status: 'queued',
          recipient: owner.email || 'web',
          idempotencyKey: ownerIdempotencyKey,
          providerPayload: {
            title: ownerTitle,
            body: ownerBody,
            taskId: task._id.toString(),
            taskTitle: task.title,
            deadlineAt: task.deadlineAt.toISOString(),
            deadlineTimezone: task.deadlineTimezone || 'Asia/Kolkata',
            deepLink,
            type: 'deadline_escalation',
            roleInNotification: 'owner',
          },
        })

        if (owner.pushTokens && owner.pushTokens.length > 0) {
          try {
            await enqueueJob(
              QUEUE_NAMES.PUSH_NOTIFICATIONS,
              `push:deadline_escalation:${task._id}:${owner._id}`,
              {
                type: 'deadline_escalation',
                userId: owner._id.toString(),
                recipient: owner.email,
                taskId: task._id.toString(),
                title: ownerTitle,
                body: ownerBody,
                to: owner.pushTokens,
                deepLink,
              },
              {
                jobId: `push:deadline_escalation:${task._id}:${owner._id}:${Date.now()}`,
              },
            )
          } catch (err: any) {}
        }

        results.owner = 'delivered'
      } else {
        results.owner = 'already_processed'
      }
    }

    // 6b. Notify Reporting Manager (deduplicated if manager is same user as owner)
    if (manager && manager.isActive && !isSameUser) {
      const mgrIdempotencyKey = `web:deadline_escalation_mgr:${task._id}:${expectedDeadlineMs}:${manager._id}`
      const existingMgrNotif = await Notification.findOne({ idempotencyKey: mgrIdempotencyKey }).exec()

      if (!existingMgrNotif) {
        const ownerName = owner ? owner.name : 'Employee'
        const mgrTitle = 'Task Deadline Escalation'
        const mgrBody = `${ownerName}'s task "${task.title}" has reached its deadline and is still incomplete.`

        await Notification.create({
          user: manager._id,
          type: 'deadline_escalation',
          task: task._id,
          channel: 'web',
          status: 'queued',
          recipient: manager.email || 'web',
          idempotencyKey: mgrIdempotencyKey,
          providerPayload: {
            title: mgrTitle,
            body: mgrBody,
            taskId: task._id.toString(),
            taskTitle: task.title,
            deadlineAt: task.deadlineAt.toISOString(),
            deadlineTimezone: task.deadlineTimezone || 'Asia/Kolkata',
            deepLink,
            type: 'deadline_escalation',
            roleInNotification: 'manager',
          },
        })

        if (manager.pushTokens && manager.pushTokens.length > 0) {
          try {
            await enqueueJob(
              QUEUE_NAMES.PUSH_NOTIFICATIONS,
              `push:deadline_escalation:${task._id}:${manager._id}`,
              {
                type: 'deadline_escalation',
                userId: manager._id.toString(),
                recipient: manager.email,
                taskId: task._id.toString(),
                title: mgrTitle,
                body: mgrBody,
                to: manager.pushTokens,
                deepLink,
              },
              {
                jobId: `push:deadline_escalation:${task._id}:${manager._id}:${Date.now()}`,
              },
            )
          } catch (err: any) {}
        }

        results.manager = 'delivered'
      } else {
        results.manager = 'already_processed'
      }
    }

    console.log(`[DEADLINE_ESCALATION] 🚨 Escalation dispatched for incomplete task "${task.title}":`, results)
    return { success: true, status: 'dispatched', results }
  },

  /**
   * Recovers and reconciles all active future deadlines (durable recovery on worker restart or Redis reconnect).
   */
  async reconcilePendingDeadlines(): Promise<number> {
    const now = new Date()
    const activeTasks = await Task.find({
      status: { $in: ['todo', 'doing'] },
      deletedAt: null,
      taskLevel: { $ne: 'parent' },
      deadlineAt: { $gt: now },
    }).exec()

    let count = 0
    for (const t of activeTasks) {
      await this.scheduleTaskDeadlineJobs(t)
      count++
    }

    console.log(`[DEADLINE_SCHEDULER] 🔄 Reconciled ${count} active task deadlines.`)
    return count
  },
}
