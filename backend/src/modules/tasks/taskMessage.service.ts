import mongoose from 'mongoose'
import { Task, type ITask } from '../../models/Task.js'
import { TaskMessage, type ITaskMessage } from '../../models/TaskMessage.js'
import { TaskDiscussionRead } from '../../models/TaskDiscussionRead.js'
import { Notification } from '../../models/Notification.js'
import { permissionsService } from '../../services/permissions.service.js'
import { taskDiscussionNotificationService } from '../../services/taskDiscussionNotification.service.js'
import { AppError } from '../../utils/AppError.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'
import type {
  CreateTaskMessageInput,
  GetTaskMessagesQueryInput,
} from './taskMessage.schemas.js'

export interface FormattedSender {
  id: string
  name: string
  role: string
}

export interface FormattedTaskMessage {
  id: string
  taskId: string
  sender: FormattedSender
  type: 'question' | 'instruction' | 'reply'
  body: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedTaskMessages {
  messages: FormattedTaskMessage[]
  data: FormattedTaskMessage[]
  total: number
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

function formatTaskMessage(msg: ITaskMessage): FormattedTaskMessage {
  const senderDoc = msg.sender as any
  let senderId = ''
  let senderName = 'Unknown User'
  let roleName = 'Member'

  if (senderDoc) {
    if (typeof senderDoc === 'object' && '_id' in senderDoc) {
      senderId = senderDoc._id.toString()
      senderName = senderDoc.name || 'Unknown User'
      const roleDoc = senderDoc.role
      if (roleDoc && typeof roleDoc === 'object' && 'name' in roleDoc) {
        roleName = roleDoc.name
      } else if (typeof roleDoc === 'string') {
        roleName = roleDoc
      }
    } else {
      senderId = senderDoc.toString()
    }
  }

  const taskId =
    msg.task && typeof msg.task === 'object' && '_id' in (msg.task as any)
      ? (msg.task as any)._id.toString()
      : msg.task.toString()

  return {
    id: msg._id.toString(),
    taskId,
    sender: {
      id: senderId,
      name: senderName,
      role: roleName,
    },
    type: msg.type,
    body: msg.body,
    createdAt: msg.createdAt ? msg.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: msg.updatedAt ? msg.updatedAt.toISOString() : new Date().toISOString(),
  }
}

async function resolveTaskDiscussionContext(task: ITask): Promise<any> {
  const taskObj = typeof (task as any).toObject === 'function' ? (task as any).toObject() : { ...task }
  if (task.taskLevel === 'parent') {
    const subtaskOwnerIds = await Task.find({ parentTask: task._id, deletedAt: null }).distinct('owner')
    taskObj.subtaskOwnerIds = subtaskOwnerIds
  }
  return taskObj
}

export const taskMessageService = {
  /**
   * Creates a new task message within a task's discussion thread.
   * Atomic operation; leaves task status and other task metadata untouched.
   */
  async createMessage(
    taskId: string,
    input: CreateTaskMessageInput,
    user: AuthenticatedUserContext,
  ): Promise<FormattedTaskMessage> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw AppError.badRequest('Invalid task ID', 'INVALID_TASK_ID')
    }

    const task = (await Task.findById(taskId).exec()) as ITask | null
    if (!task || task.deletedAt !== null) {
      throw AppError.notFound('Task not found or has been deleted', 'TASK_NOT_FOUND')
    }

    const taskContext = await resolveTaskDiscussionContext(task)
    const canAccess = permissionsService.canAccessTaskDiscussion(user, taskContext)
    if (!canAccess) {
      throw AppError.forbidden(
        'You do not have permission to participate in this task discussion',
        'FORBIDDEN',
      )
    }

    const newMessage = await TaskMessage.create({
      task: task._id,
      sender: user.id,
      type: input.type,
      body: input.body,
    })

    // Advance sender's own read cursor to message creation time
    try {
      await TaskDiscussionRead.findOneAndUpdate(
        { task: task._id, user: user.id },
        { $set: { lastReadAt: newMessage.createdAt || new Date() } },
        { upsert: true, returnDocument: 'after' },
      )
    } catch (cursorErr: any) {
      console.warn('[TASK_DISCUSSION] Could not update sender read cursor:', cursorErr?.message)
    }

    // Trigger durable participant notifications
    try {
      await taskDiscussionNotificationService.handleMessageCreated(
        newMessage,
        task,
        { id: user.id, name: user.name },
      )
    } catch (notifErr) {
      console.error('[TASK_DISCUSSION] Error dispatching notifications:', notifErr)
    }

    const populated = await TaskMessage.findById(newMessage._id)
      .populate({
        path: 'sender',
        select: 'name role',
        populate: { path: 'role', select: 'name' },
      })
      .exec()

    return formatTaskMessage(populated!)
  },

  /**
   * Retrieves the unread message count and cursor timestamp for the current user.
   */
  async getUnreadCount(
    taskId: string,
    user: AuthenticatedUserContext,
  ): Promise<{ unreadCount: number; lastReadAt: string | null }> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw AppError.badRequest('Invalid task ID', 'INVALID_TASK_ID')
    }

    const task = (await Task.findById(taskId).exec()) as ITask | null
    if (!task || task.deletedAt !== null) {
      throw AppError.notFound('Task not found or has been deleted', 'TASK_NOT_FOUND')
    }

    const taskContext = await resolveTaskDiscussionContext(task)
    const canAccess = permissionsService.canAccessTaskDiscussion(user, taskContext)
    if (!canAccess) {
      throw AppError.forbidden(
        'You do not have permission to view discussions for this task',
        'FORBIDDEN',
      )
    }

    const readCursor = await TaskDiscussionRead.findOne({
      task: task._id,
      user: user.id,
    })
      .lean()
      .exec()

    const filter: Record<string, any> = {
      task: task._id,
      sender: { $ne: new mongoose.Types.ObjectId(user.id) },
    }

    if (readCursor && readCursor.lastReadAt) {
      filter.createdAt = { $gt: readCursor.lastReadAt }
    }

    const unreadCount = await TaskMessage.countDocuments(filter).exec()

    return {
      unreadCount,
      lastReadAt: readCursor?.lastReadAt ? readCursor.lastReadAt.toISOString() : null,
    }
  },

  /**
   * Marks discussion messages as read for the current user:
   * 1. Upserts the user's per-task read cursor in TaskDiscussionRead to now.
   * 2. Marks any matching web notification records for this task as read.
   */
  async markDiscussionAsRead(
    taskId: string,
    user: AuthenticatedUserContext,
  ): Promise<{ success: boolean; lastReadAt: string }> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw AppError.badRequest('Invalid task ID', 'INVALID_TASK_ID')
    }

    const task = (await Task.findById(taskId).exec()) as ITask | null
    if (!task || task.deletedAt !== null) {
      throw AppError.notFound('Task not found or has been deleted', 'TASK_NOT_FOUND')
    }

    const taskContext = await resolveTaskDiscussionContext(task)
    const canAccess = permissionsService.canAccessTaskDiscussion(user, taskContext)
    if (!canAccess) {
      throw AppError.forbidden(
        'You do not have permission to view discussions for this task',
        'FORBIDDEN',
      )
    }

    const now = new Date()

    // 1. Upsert discussion read cursor
    await TaskDiscussionRead.findOneAndUpdate(
      { task: task._id, user: user.id },
      { $set: { lastReadAt: now } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).exec()

    // 2. Mark any queued web notifications for this task as read
    try {
      await Notification.updateMany(
        {
          user: new mongoose.Types.ObjectId(user.id),
          task: task._id,
          type: 'task_discussion_message',
          channel: 'web',
          status: 'queued',
        },
        {
          $set: { status: 'sent', sentAt: now },
        },
      ).exec()
    } catch (notifErr: any) {
      console.warn('[TASK_DISCUSSION] Warning marking notifications as read:', notifErr?.message)
    }

    return {
      success: true,
      lastReadAt: now.toISOString(),
    }
  },

  /**
   * Retrieves chronological messages for a task's discussion thread.
   * Supports stable cursor-based pagination.
   */
  async getMessages(
    taskId: string,
    query: GetTaskMessagesQueryInput,
    user: AuthenticatedUserContext,
  ): Promise<PaginatedTaskMessages> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw AppError.badRequest('Invalid task ID', 'INVALID_TASK_ID')
    }

    const task = (await Task.findById(taskId).exec()) as ITask | null
    if (!task || task.deletedAt !== null) {
      throw AppError.notFound('Task not found or has been deleted', 'TASK_NOT_FOUND')
    }

    const taskContext = await resolveTaskDiscussionContext(task)
    const canAccess = permissionsService.canAccessTaskDiscussion(user, taskContext)
    if (!canAccess) {
      throw AppError.forbidden(
        'You do not have permission to view discussions for this task',
        'FORBIDDEN',
      )
    }

    const limit = query.limit || 50
    const filter: Record<string, any> = {
      task: task._id,
    }

    if (query.cursor) {
      let cursorCreatedAt: Date | null = null
      let cursorId: mongoose.Types.ObjectId | null = null

      try {
        const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf8'))
        if (decoded.createdAt && decoded.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
          cursorCreatedAt = new Date(decoded.createdAt)
          cursorId = new mongoose.Types.ObjectId(decoded.id)
        }
      } catch {
        if (mongoose.Types.ObjectId.isValid(query.cursor)) {
          const cursorDoc = await TaskMessage.findById(query.cursor)
            .select('createdAt _id')
            .lean()
            .exec()
          if (cursorDoc) {
            cursorCreatedAt = cursorDoc.createdAt
            cursorId = cursorDoc._id as mongoose.Types.ObjectId
          }
        }
      }

      if (cursorCreatedAt && cursorId) {
        filter.$or = [
          { createdAt: { $gt: cursorCreatedAt } },
          { createdAt: cursorCreatedAt, _id: { $gt: cursorId } },
        ]
      }
    }

    const [messages, total] = await Promise.all([
      TaskMessage.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .limit(limit + 1)
        .populate({
          path: 'sender',
          select: 'name role',
          populate: { path: 'role', select: 'name' },
        })
        .exec(),
      TaskMessage.countDocuments({ task: task._id }).exec(),
    ])

    const hasMore = messages.length > limit
    const pageMessages = hasMore ? messages.slice(0, limit) : messages

    let nextCursor: string | null = null
    if (hasMore && pageMessages.length > 0) {
      const last = pageMessages[pageMessages.length - 1]
      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          id: last._id.toString(),
        }),
      ).toString('base64')
    }

    const formatted = pageMessages.map(formatTaskMessage)

    return {
      messages: formatted,
      data: formatted,
      total,
      limit,
      nextCursor,
      hasMore,
    }
  },
}

