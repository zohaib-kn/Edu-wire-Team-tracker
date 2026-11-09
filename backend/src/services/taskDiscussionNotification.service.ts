import mongoose from 'mongoose'
import { User, type IUser } from '../models/User.js'
import { Task, type ITask } from '../models/Task.js'
import { TaskMessage, type ITaskMessage } from '../models/TaskMessage.js'
import { Notification } from '../models/Notification.js'
import { enqueueJob } from '../queues/queue.manager.js'
import { QUEUE_NAMES } from '../queues/queue.config.js'
import { permissionsService } from './permissions.service.js'
import type { AuthenticatedUserContext } from '../types/auth.types.js'

export interface TaskDiscussionNotificationResult {
  notifiedUserIds: string[]
  webNotificationsCreated: number
  pushJobsQueued: number
}

function toIdString(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && '_id' in (val as Record<string, unknown>)) {
    return ((val as Record<string, unknown>)._id as mongoose.Types.ObjectId | string).toString()
  }
  return String(val)
}

export const taskDiscussionNotificationService = {
  /**
   * Resolves eligible recipients for a task discussion message:
   * 1. Task Owner (task.owner)
   * 2. Reporting Manager (task.reportingManager)
   * 3. Task Creator (task.createdBy)
   * 4. Previous discussion participants (distinct senders in TaskMessage for this task)
   *
   * Filters applied:
   * - Excludes message sender (no self-notifications)
   * - Deduplicates multiple roles for same user (single alert per channel)
   * - Excludes inactive users (isActive === false)
   * - Excludes users who do NOT have current authorized task discussion access
   */
  async resolveRecipients(task: ITask, senderId: string): Promise<IUser[]> {
    const candidateIdSet = new Set<string>()

    const ownerId = toIdString(task.owner)
    if (ownerId) candidateIdSet.add(ownerId)

    const managerId = toIdString(task.reportingManager)
    if (managerId) candidateIdSet.add(managerId)

    const createdById = toIdString(task.createdBy)
    if (createdById) candidateIdSet.add(createdById)

    const taskContext: any = typeof (task as any).toObject === 'function' ? (task as any).toObject() : { ...task }
    if (task.taskLevel === 'parent') {
      const subtaskOwnerIds = await Task.find({ parentTask: task._id, deletedAt: null }).distinct('owner')
      taskContext.subtaskOwnerIds = subtaskOwnerIds
      for (const stOwner of subtaskOwnerIds) {
        const sStr = toIdString(stOwner)
        if (sStr) candidateIdSet.add(sStr)
      }
    }

    // Retrieve all previous senders who participated in this task conversation
    const previousSenderIds = await TaskMessage.distinct('sender', {
      task: task._id,
    }).exec()

    for (const sid of previousSenderIds) {
      const sidStr = toIdString(sid)
      if (sidStr) candidateIdSet.add(sidStr)
    }

    // Exclude sender
    candidateIdSet.delete(senderId.toString())

    if (candidateIdSet.size === 0) {
      return []
    }

    const candidateObjectIds = Array.from(candidateIdSet)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const candidateUsers = await User.find({
      _id: { $in: candidateObjectIds },
      isActive: true,
    })
      .populate('role')
      .exec()

    const eligibleRecipients: IUser[] = []

    for (const u of candidateUsers) {
      const roleDoc = u.role as any
      const roleName = roleDoc && typeof roleDoc === 'object' ? roleDoc.name : String(roleDoc || 'Member')
      const permissions = (roleDoc && roleDoc.permissions) || []

      const userContext: AuthenticatedUserContext = {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: roleName,
        branchId: u.branch ? u.branch.toString() : null,
        teamId: u.teams && u.teams.length > 0 ? u.teams[0].toString() : null,
        teams: (u.teams || []).map((t) => t.toString()),
        mustChangePassword: u.mustChangePassword,
        status: u.isActive ? 'active' : 'inactive',
        permissions,
        rawUser: u,
      }

      // Verify current discussion authorization
      const hasAccess = permissionsService.canAccessTaskDiscussion(userContext, taskContext)
      if (hasAccess) {
        eligibleRecipients.push(u)
      }
    }

    return eligibleRecipients
  },

  /**
   * Handles dispatching notifications after a task message is saved in MongoDB:
   * 1. Resolves eligible recipients.
   * 2. Creates durable web notification records in MongoDB.
   * 3. Queues push notification jobs in BullMQ.
   *
   * Redis outages do not crash or abort the caller; web notification records
   * remain durable in MongoDB.
   */
  async handleMessageCreated(
    message: ITaskMessage,
    task: ITask,
    sender: { id: string; name: string },
  ): Promise<TaskDiscussionNotificationResult> {
    const recipients = await this.resolveRecipients(task, sender.id)

    if (recipients.length === 0) {
      return {
        notifiedUserIds: [],
        webNotificationsCreated: 0,
        pushJobsQueued: 0,
      }
    }

    const taskIdStr = task._id.toString()
    const messageIdStr = message._id.toString()
    const cleanBody = (message.body || '').trim()
    const preview = cleanBody.length > 80 ? cleanBody.slice(0, 77) + '...' : cleanBody
    const title = `New update on ${task.title}`
    const body = `${sender.name}: ${preview}`
    const deepLink = `edutracker://tasks/${taskIdStr}?tab=discussion`

    let webNotificationsCreated = 0
    let pushJobsQueued = 0
    const notifiedUserIds: string[] = []

    for (const recipient of recipients) {
      const recipientIdStr = recipient._id.toString()
      notifiedUserIds.push(recipientIdStr)

      // 1. Create durable web notification intent in MongoDB
      try {
        const idempotencyKey = `notif:${messageIdStr}:${recipientIdStr}:web`
        await Notification.create({
          user: recipient._id,
          type: 'task_discussion_message',
          task: task._id,
          channel: 'web',
          status: 'queued',
          recipient: recipient.email || 'web',
          idempotencyKey,
          providerPayload: {
            title,
            body,
            senderName: sender.name,
            senderId: sender.id,
            taskId: taskIdStr,
            taskTitle: task.title,
            messageId: messageIdStr,
            messageType: message.type,
            deepLink,
          },
        })
        webNotificationsCreated++
      } catch (err: any) {
        // If duplicate key error (E11000), idempotency handled safely
        if (err?.code !== 11000) {
          console.error(`[DISCUSSION_NOTIF] Failed creating web notification for ${recipient.email}:`, err.message)
        }
      }

      // 2. Queue BullMQ Push Notification Job
      try {
        const pushTokens = recipient.pushTokens || []
        await enqueueJob(
          QUEUE_NAMES.PUSH_NOTIFICATIONS,
          `discussion_push:${messageIdStr}:${recipientIdStr}`,
          {
            type: 'task_discussion_message',
            userId: recipientIdStr,
            recipient: recipient.email,
            taskId: taskIdStr,
            taskTitle: task.title,
            messageId: messageIdStr,
            title,
            body,
            to: pushTokens,
            deepLink,
          },
          {
            jobId: `discussion_push:${messageIdStr}:${recipientIdStr}`,
          },
        )
        pushJobsQueued++
      } catch (queueErr: any) {
        console.warn(
          `[DISCUSSION_NOTIF] Redis push enqueue failed for ${recipient.email} (web notification preserved in MongoDB):`,
          queueErr?.message,
        )
      }
    }

    return {
      notifiedUserIds,
      webNotificationsCreated,
      pushJobsQueued,
    }
  },
}
