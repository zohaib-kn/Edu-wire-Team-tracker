import mongoose from 'mongoose'
import { Task } from '../models/Task.js'
import { User, type IUser } from '../models/User.js'
import { Role, type IRole } from '../models/Role.js'
import { Notification } from '../models/Notification.js'
import { reportService } from '../modules/reports/report.service.js'
import { whatsappService } from '../services/whatsapp/whatsapp.service.js'
import { expoService } from '../services/expo.service.js'
import { getTodayDateIST, getSevenDaysAgoIST } from '../utils/dateUtils.js'
import {
  getTaskRemindersQueue,
  getWhatsappReportsQueue,
  enqueueJob,
} from '../queues/queue.manager.js'
import { QUEUE_NAMES } from '../queues/queue.config.js'

export const CRON_SCHEDULES = {
  DUE_TODAY_REMINDERS: '0 9 * * *', // 9:00 AM IST daily
  DAILY_PENDING_REPORTS: '30 9 * * *', // 9:30 AM IST daily
  OVERDUE_REMINDERS: '0 10 * * *', // 10:00 AM IST daily
  WEEKLY_SUMMARY: '30 9 * * 1', // 9:30 AM IST every Monday
}

export const notificationScheduler = {
  /**
   * Registers BullMQ repeatable cron schedules.
   */
  async initScheduledJobs(): Promise<void> {
    const remindersQueue = getTaskRemindersQueue()
    const waQueue = getWhatsappReportsQueue()

    // 1. Due Today Reminders (9:00 AM IST)
    await remindersQueue.add(
      'schedule:due-today',
      { type: 'due_today' },
      {
        repeat: { pattern: CRON_SCHEDULES.DUE_TODAY_REMINDERS, tz: 'Asia/Kolkata' },
        jobId: 'repeat:due-today',
      } as any,
    )

    // 2. Daily Pending WhatsApp Reports (9:30 AM IST)
    await waQueue.add(
      'schedule:daily-pending',
      { type: 'daily_pending' },
      {
        repeat: { pattern: CRON_SCHEDULES.DAILY_PENDING_REPORTS, tz: 'Asia/Kolkata' },
        jobId: 'repeat:daily-pending',
      } as any,
    )

    // 3. Overdue Reminders (10:00 AM IST)
    await remindersQueue.add(
      'schedule:overdue',
      { type: 'overdue' },
      {
        repeat: { pattern: CRON_SCHEDULES.OVERDUE_REMINDERS, tz: 'Asia/Kolkata' },
        jobId: 'repeat:overdue',
      } as any,
    )

    // 4. Weekly Summary (Monday 9:30 AM IST)
    await waQueue.add(
      'schedule:weekly-summary',
      { type: 'weekly_summary' },
      {
        repeat: { pattern: CRON_SCHEDULES.WEEKLY_SUMMARY, tz: 'Asia/Kolkata' },
        jobId: 'repeat:weekly-summary',
      } as any,
    )

    console.log('[SCHEDULER] ✅ All 4 BullMQ repeatable cron schedules registered in Asia/Kolkata.')
  },

  /**
   * 1. Daily Due-Today Reminder (9:00 AM IST)
   * Dispatches push notifications to owners of tasks due today.
   */
  async dispatchDueTodayReminders(customDateIST?: string): Promise<{ dispatched: number; skipped: number }> {
    const todayIST = customDateIST || getTodayDateIST()

    // Query active, incomplete actionable tasks due today (exclude parent coordination containers)
    const tasks = await Task.find({
      due: todayIST,
      status: { $in: ['todo', 'doing'] },
      taskLevel: { $ne: 'parent' },
      deletedAt: null,
    })
      .populate<{ owner: IUser }>('owner')
      .exec()

    let dispatched = 0
    let skipped = 0

    for (const task of tasks) {
      const owner = task.owner as unknown as IUser
      if (!owner || !owner.isActive) {
        skipped++
        continue
      }

      const idempotencyKey = `due_today:${task._id}:${owner._id}:push:${todayIST}`

      // Check if already sent
      const existing = await Notification.findOne({ idempotencyKey }).exec()
      if (existing) {
        skipped++
        continue
      }

      // Check device tokens
      const pushTokens = owner.pushTokens || []
      if (pushTokens.length === 0) {
        await Notification.create({
          user: owner._id,
          type: 'task_reminder',
          task: task._id,
          channel: 'push',
          status: 'skipped',
          recipient: 'none',
          error: 'NO_PUSH_TOKENS',
          idempotencyKey,
        })
        skipped++
        continue
      }

      // Send push notification
      const pushResult = await expoService.sendPushNotification({
        to: pushTokens,
        userId: owner._id.toString(),
        title: 'Task Due Today',
        body: `Your task "${task.title}" is due today.`,
        data: {
          taskId: task._id.toString(),
          due: task.due,
          type: 'due_today',
          deepLink: `edutracker://tasks/${task._id}`,
        },
      })

      await Notification.create({
        user: owner._id,
        type: 'task_reminder',
        task: task._id,
        channel: 'push',
        status: pushResult.status,
        recipient: pushTokens[0],
        sentAt: pushResult.accepted ? new Date() : null,
        error: pushResult.error || pushResult.skipReason || null,
        idempotencyKey,
      })

      if (pushResult.accepted) dispatched++
      else skipped++
    }

    return { dispatched, skipped }
  },

  /**
   * 2. Daily Pending WhatsApp Report (9:30 AM IST)
   * Dispatches WhatsApp pending summaries to Team Leads and Branch Admins within their scope.
   */
  async dispatchDailyPendingReports(customDateIST?: string): Promise<{ dispatched: number; skipped: number }> {
    const todayIST = customDateIST || getTodayDateIST()

    // Find Team Leads and Branch Admins
    const leadRole = await Role.findOne({ name: 'Team Lead' }).exec()
    const adminRole = await Role.findOne({ name: 'Branch Admin' }).exec()
    const roleIds = [leadRole?._id, adminRole?._id].filter(Boolean)

    const managers = await User.find({
      role: { $in: roleIds },
      isActive: true,
    })
      .populate('role')
      .populate('teams')
      .exec()

    let dispatched = 0
    let skipped = 0

    for (const manager of managers) {
      const roleName = (manager.role as any)?.name || 'Team Lead'
      const idempotencyKey = `daily_pending:${manager._id}:whatsapp:${todayIST}`

      const existing = await Notification.findOne({ idempotencyKey }).exec()
      if (existing) {
        skipped++
        continue
      }

      const userContext = {
        id: manager._id.toString(),
        name: manager.name,
        email: manager.email,
        role: roleName,
        branchId: manager.branch ? manager.branch.toString() : null,
        teamIds: Array.isArray(manager.teams)
          ? manager.teams.map((t: any) => (t._id ? t._id.toString() : t.toString()))
          : [],
        permissions: (manager.role as any)?.permissions || [],
      }

      // Generate authorized daily report
      const reportData = await reportService.getDailyReport({}, userContext as any)

      // Format WhatsApp template parameters
      const templateParams = {
        recipient_name: manager.name,
        report_date: todayIST,
        total_pending: String(reportData.reportText.match(/Total Incomplete Tasks:\s+(\d+)/)?.[1] || '0'),
        high_priority_count: String(reportData.reportText.match(/High Priority Tasks:\s+(\d+)/)?.[1] || '0'),
        overdue_count: String(reportData.reportText.match(/Overdue \/ Late Tasks:\s+(\d+)/)?.[1] || '0'),
        report_summary: reportData.reportText,
      }

      const waResult = await whatsappService.sendTemplate({
        recipient: manager.phone || '',
        templateName: 'daily_pending_report',
        parameters: templateParams,
        idempotencyKey,
      })

      await Notification.create({
        user: manager._id,
        type: 'daily_report',
        channel: 'whatsapp',
        status: waResult.status,
        recipient: manager.phone || 'unknown',
        sentAt: waResult.accepted ? new Date() : null,
        error: waResult.error || waResult.skipReason || null,
        jobId: waResult.providerMessageId || null,
        idempotencyKey,
        providerPayload: templateParams,
        providerResponse: waResult.rawResponse || null,
      })

      if (waResult.accepted) dispatched++
      else skipped++
    }

    return { dispatched, skipped }
  },

  /**
   * 3. Late-Task Overdue Reminders (10:00 AM IST)
   * Dispatches BOTH Expo Push AND WhatsApp notifications to owners of overdue incomplete tasks.
   * Completed tasks (status === 'done') are strictly excluded!
   */
  async dispatchOverdueReminders(customDateIST?: string): Promise<{ dispatched: number; skipped: number }> {
    const todayIST = customDateIST || getTodayDateIST()

    // Incomplete actionable tasks where due < todayIST (exclude parent coordination containers)
    const overdueTasks = await Task.find({
      due: { $lt: todayIST },
      status: { $in: ['todo', 'doing'] },
      taskLevel: { $ne: 'parent' },
      deletedAt: null,
    })
      .populate<{ owner: IUser }>('owner')
      .exec()

    let dispatched = 0
    let skipped = 0

    for (const task of overdueTasks) {
      // STRICT CONSTRAINT: If somehow marked done, NEVER send overdue reminder
      if (task.status === 'done') continue

      const owner = task.owner as unknown as IUser
      if (!owner || !owner.isActive) {
        skipped++
        continue
      }

      // --- Channel 1: Expo Push ---
      const pushKey = `overdue:${task._id}:${owner._id}:push:${todayIST}`
      const existingPush = await Notification.findOne({ idempotencyKey: pushKey }).exec()
      if (!existingPush) {
        const pushTokens = owner.pushTokens || []
        if (pushTokens.length === 0) {
          await Notification.create({
            user: owner._id,
            type: 'task_reminder',
            task: task._id,
            channel: 'push',
            status: 'skipped',
            recipient: 'none',
            error: 'NO_PUSH_TOKENS',
            idempotencyKey: pushKey,
          })
          skipped++
        } else {
          const pushResult = await expoService.sendPushNotification({
            to: pushTokens,
            userId: owner._id.toString(),
            title: 'Task Overdue Notice',
            body: `Your task "${task.title}" was due on ${task.due} and is now overdue.`,
            priority: 'high',
            data: {
              taskId: task._id.toString(),
              due: task.due,
              type: 'overdue',
              deepLink: `edutracker://tasks/${task._id}`,
            },
          })

          await Notification.create({
            user: owner._id,
            type: 'task_reminder',
            task: task._id,
            channel: 'push',
            status: pushResult.status,
            recipient: pushTokens[0],
            sentAt: pushResult.accepted ? new Date() : null,
            error: pushResult.error || pushResult.skipReason || null,
            idempotencyKey: pushKey,
          })

          if (pushResult.accepted) dispatched++
          else skipped++
        }
      }

      // --- Channel 2: WhatsApp ---
      const waKey = `overdue:${task._id}:${owner._id}:whatsapp:${todayIST}`
      const existingWa = await Notification.findOne({ idempotencyKey: waKey }).exec()
      if (!existingWa) {
        const waParams = {
          employee_name: owner.name,
          task_title: task.title,
          due_date: task.due,
          deep_link_url: `edutracker://tasks/${task._id}`,
        }

        const waResult = await whatsappService.sendTemplate({
          recipient: owner.phone || '',
          templateName: 'task_overdue',
          parameters: waParams,
          idempotencyKey: waKey,
        })

        await Notification.create({
          user: owner._id,
          type: 'task_reminder',
          task: task._id,
          channel: 'whatsapp',
          status: waResult.status,
          recipient: owner.phone || 'unknown',
          sentAt: waResult.accepted ? new Date() : null,
          error: waResult.error || waResult.skipReason || null,
          jobId: waResult.providerMessageId || null,
          idempotencyKey: waKey,
          providerPayload: waParams,
        })

        if (waResult.accepted) dispatched++
        else skipped++
      }
    }

    return { dispatched, skipped }
  },

  /**
   * 4. Weekly Summary Report (Monday 9:30 AM IST)
   * Dispatches WhatsApp 7-day completion and pending overview to Super Admins.
   */
  async dispatchWeeklySummary(customDateIST?: string): Promise<{ dispatched: number; skipped: number }> {
    const todayIST = customDateIST || getTodayDateIST()

    const superAdminRole = await Role.findOne({ name: 'Super Admin' }).exec()
    if (!superAdminRole) return { dispatched: 0, skipped: 0 }

    const superAdmins = await User.find({
      role: superAdminRole._id,
      isActive: true,
    }).exec()

    let dispatched = 0
    let skipped = 0

    for (const admin of superAdmins) {
      const idempotencyKey = `weekly_summary:${admin._id}:whatsapp:${todayIST}`

      const existing = await Notification.findOne({ idempotencyKey }).exec()
      if (existing) {
        skipped++
        continue
      }

      const adminContext = {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: 'Super Admin',
        branchId: null,
        teamIds: [],
        permissions: superAdminRole.permissions,
      }

      // Generate weekly performance stats using actual database records
      const weeklyReport = await reportService.getWeeklyReport({}, adminContext as any)

      const breakdownSummary = weeklyReport.teams
        .map(
          (t) =>
            `• ${t.team} (${t.branch || 'General'}): ${t.completed} done, ${t.pending} pending (${t.completionRate}%)`,
        )
        .join('\n')

      const templateParams = {
        admin_name: admin.name,
        period_label: weeklyReport.period,
        total_completed: String(weeklyReport.completed),
        total_pending: String(weeklyReport.pending),
        completion_rate: `${weeklyReport.completionRate}%`,
        breakdown_summary: breakdownSummary,
      }

      const waResult = await whatsappService.sendTemplate({
        recipient: admin.phone || '',
        templateName: 'weekly_summary',
        parameters: templateParams,
        idempotencyKey,
      })

      await Notification.create({
        user: admin._id,
        type: 'weekly_summary',
        channel: 'whatsapp',
        status: waResult.status,
        recipient: admin.phone || 'unknown',
        sentAt: waResult.accepted ? new Date() : null,
        error: waResult.error || waResult.skipReason || null,
        jobId: waResult.providerMessageId || null,
        idempotencyKey,
        providerPayload: templateParams,
      })

      if (waResult.accepted) dispatched++
      else skipped++
    }

    return { dispatched, skipped }
  },
}
