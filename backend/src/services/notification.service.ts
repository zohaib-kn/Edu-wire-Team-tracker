import mongoose from 'mongoose'
import { User, type IUser } from '../models/User.js'
import { Team, type ITeam } from '../models/Team.js'
import { Task, type ITask } from '../models/Task.js'
import { Role } from '../models/Role.js'
import { Notification } from '../models/Notification.js'
import { enqueueJob } from '../queues/queue.manager.js'
import { QUEUE_NAMES } from '../queues/queue.config.js'

export interface TaskAssignmentJobData {
  userId: string
  recipient: string
  taskId: string
  taskTitle: string
  employeeName: string
  roleInTask: 'owner' | 'manager'
  notificationType: 'task_assigned' | 'task_supervised' | 'task_reassigned'
  title: string
  body: string
  deepLink: string
  due: string
  priority: string
}

export const notificationService = {
  /**
   * Resolves the effective reporting manager for a task.
   * Priority:
   * 1. Explicitly saved reportingManager
   * 2. Fallback to active Team Lead of the team (not persisted)
   */
  async resolveReportingManager(
    task: any,
  ): Promise<{ manager: (IUser & { _id: mongoose.Types.ObjectId }) | null; isFallback: boolean }> {
    const rawManagerId = task.reportingManager
      ? task.reportingManager._id || task.reportingManager
      : null

    if (rawManagerId && mongoose.Types.ObjectId.isValid(rawManagerId)) {
      const manager = await User.findById(rawManagerId).exec()
      if (manager) {
        return { manager: manager as any, isFallback: false }
      }
    }

    // Fallback to team's active lead
    const rawTeamId = task.team ? task.team._id || task.team : null
    if (rawTeamId && mongoose.Types.ObjectId.isValid(rawTeamId)) {
      const teamDoc = await Team.findById(rawTeamId).populate<{ lead: IUser }>('lead').exec()
      if (teamDoc && teamDoc.lead && (teamDoc.lead as any).isActive) {
        return { manager: teamDoc.lead as any, isFallback: true }
      }
    }

    return { manager: null, isFallback: false }
  },

  /**
   * Triggers assignment notifications when a new task is created.
   * Notifies BOTH the Task Owner and the Reporting Manager.
   * Deduplicates if owner and manager are the same user.
   */
  async handleTaskCreated(task: any): Promise<void> {
    const taskId = (task.id || task._id).toString()
    const rawOwnerId = task.owner ? task.owner._id || task.owner : null

    if (!rawOwnerId || !mongoose.Types.ObjectId.isValid(rawOwnerId)) {
      return
    }

    const owner = (await User.findById(rawOwnerId).exec()) as (IUser & { _id: mongoose.Types.ObjectId }) | null
    if (!owner) return

    const { manager } = await this.resolveReportingManager(task)

    const isSameUser = manager && manager._id.toString() === owner._id.toString()

    // 1. Notify Task Owner
    if (owner.isActive) {
      const ownerJobData: TaskAssignmentJobData = {
        userId: owner._id.toString(),
        recipient: owner.email,
        taskId,
        taskTitle: task.title,
        employeeName: owner.name,
        roleInTask: 'owner',
        notificationType: 'task_assigned',
        title: 'New Task Assigned',
        body: `You have been assigned a task: ${task.title}.`,
        deepLink: `edutracker://tasks/${taskId}`,
        due: task.due || '',
        priority: task.priority || 'normal',
      }

      // Durable Web Notification in MongoDB
      try {
        await Notification.create({
          user: owner._id,
          type: 'task_assigned',
          task: task._id || taskId,
          channel: 'web',
          status: 'queued',
          recipient: owner.email || 'web',
          idempotencyKey: `web:assign:${taskId}:${owner._id}`,
          providerPayload: {
            title: ownerJobData.title,
            body: ownerJobData.body,
            taskId,
            taskTitle: task.title,
            deepLink: ownerJobData.deepLink,
            type: 'task_assigned',
          },
        })
      } catch (dbErr: any) {}

      await enqueueJob(
        QUEUE_NAMES.TASK_ASSIGNMENT,
        `assign:${taskId}:${owner._id}`,
        ownerJobData,
        {
          jobId: `assign:${taskId}:${owner._id}`,
        },
      )
    } else {
      // Record skip for inactive owner
      await Notification.create({
        user: owner._id,
        type: 'task_assigned',
        task: taskId,
        channel: 'push',
        status: 'skipped',
        recipient: owner.email || 'unknown',
        error: 'USER_INACTIVE',
        idempotencyKey: `skip:assign:${taskId}:${owner._id}`,
      })
    }

    // 2. Notify Reporting Manager (if not deduplicated with owner)
    if (isSameUser) {
      // Deduplicated: Do not send a second notification to the same user
      return
    }

    if (!manager) {
      // Record skip reason: no eligible reporting manager
      await Notification.create({
        user: owner._id, // record against owner/task audit
        type: 'task_supervised',
        task: taskId,
        channel: 'push',
        status: 'skipped',
        recipient: 'none',
        error: 'NO_ELIGIBLE_REPORTING_MANAGER',
        idempotencyKey: `skip:manager:${taskId}`,
      })
      return
    }

    if (manager.isActive) {
      const managerJobData: TaskAssignmentJobData = {
        userId: manager._id.toString(),
        recipient: manager.email,
        taskId,
        taskTitle: task.title,
        employeeName: owner.name,
        roleInTask: 'manager',
        notificationType: 'task_supervised',
        title: 'New Task Under Your Supervision',
        body: `${owner.name} has been assigned: ${task.title}.`,
        deepLink: `edutracker://tasks/${taskId}`,
        due: task.due || '',
        priority: task.priority || 'normal',
      }

      // Durable Web Notification in MongoDB
      try {
        await Notification.create({
          user: manager._id,
          type: 'task_supervised',
          task: task._id || taskId,
          channel: 'web',
          status: 'queued',
          recipient: manager.email || 'web',
          idempotencyKey: `web:supervise:${taskId}:${manager._id}`,
          providerPayload: {
            title: managerJobData.title,
            body: managerJobData.body,
            taskId,
            taskTitle: task.title,
            deepLink: managerJobData.deepLink,
            type: 'task_supervised',
          },
        })
      } catch (dbErr: any) {}

      await enqueueJob(
        QUEUE_NAMES.TASK_ASSIGNMENT,
        `supervise:${taskId}:${manager._id}`,
        managerJobData,
        {
          jobId: `supervise:${taskId}:${manager._id}`,
        },
      )
    } else {
      // Inactive manager
      await Notification.create({
        user: manager._id,
        type: 'task_supervised',
        task: taskId,
        channel: 'push',
        status: 'skipped',
        recipient: manager.email || 'unknown',
        error: 'USER_INACTIVE',
        idempotencyKey: `skip:manager:${taskId}:${manager._id}`,
      })
    }
  },

  /**
   * Triggers notifications for multi-assignee parent task creation:
   * 1. Each assigned employee receives their individual subtask notification.
   * 2. The reporting manager receives a single clear overall supervision notification.
   * 3. Creator (e.g. Super Admin) is excluded from self-notifications.
   * 4. Inactive users are skipped and recorded.
   * 5. Deduplication ensures no duplicate parent + child alerts to the same user.
   */
  async handleParentTaskCreated(
    parentTask: any,
    subtasks: any[],
    creatorUser?: { id: string; name?: string },
  ): Promise<void> {
    const parentId = (parentTask.id || parentTask._id).toString()
    const creatorId = creatorUser ? creatorUser.id.toString() : null

    // 1. Resolve and notify Reporting Manager with clear overall message
    const { manager } = await this.resolveReportingManager(parentTask)
    const managerIdStr = manager ? manager._id.toString() : null

    if (manager && manager.isActive) {
      if (managerIdStr !== creatorId) {
        const assignmentCount = subtasks.length
        const title = 'New Task Under Your Supervision'
        const body = `You are supervising ${parentTask.title} with ${assignmentCount} assignment${assignmentCount === 1 ? '' : 's'}.`
        const deepLink = `edutracker://tasks/${parentId}`

        // Create web notification in MongoDB
        try {
          await Notification.create({
            user: manager._id,
            type: 'task_supervised',
            task: parentTask._id || parentId,
            channel: 'web',
            status: 'queued',
            recipient: manager.email || 'web',
            idempotencyKey: `web:supervise:${parentId}:${manager._id}`,
            providerPayload: {
              title,
              body,
              taskId: parentId,
              taskTitle: parentTask.title,
              deepLink,
              type: 'task_supervised',
            },
          })
        } catch (dbErr: any) {}

        const managerJobData: TaskAssignmentJobData = {
          userId: managerIdStr!,
          recipient: manager.email,
          taskId: parentId,
          taskTitle: parentTask.title,
          employeeName: 'Multiple Employees',
          roleInTask: 'manager',
          notificationType: 'task_supervised',
          title,
          body,
          deepLink,
          due: parentTask.due || '',
          priority: parentTask.priority || 'normal',
        }

        await enqueueJob(
          QUEUE_NAMES.TASK_ASSIGNMENT,
          `supervise:${parentId}:${manager._id}`,
          managerJobData,
          {
            jobId: `supervise:${parentId}:${manager._id}`,
          },
        )
      }
    } else if (manager && !manager.isActive) {
      await Notification.create({
        user: manager._id,
        type: 'task_supervised',
        task: parentTask._id || parentId,
        channel: 'push',
        status: 'skipped',
        recipient: manager.email || 'unknown',
        error: 'USER_INACTIVE',
        idempotencyKey: `skip:manager:${parentId}:${manager._id}`,
      })
    }

    // 2. Notify each assigned employee for their individual subtask
    for (const sub of subtasks) {
      const subId = (sub.id || sub._id).toString()
      const rawOwnerId = sub.owner ? (sub.owner._id || sub.owner) : null
      if (!rawOwnerId || !mongoose.Types.ObjectId.isValid(rawOwnerId)) continue

      const owner = (await User.findById(rawOwnerId).exec()) as (IUser & { _id: mongoose.Types.ObjectId }) | null
      if (!owner) continue

      const ownerIdStr = owner._id.toString()
      // Skip self-notification if creator is the assignee
      if (ownerIdStr === creatorId) continue

      if (owner.isActive) {
        const title = 'New Task Assigned'
        const body = `You have been assigned ${sub.title}.`
        const deepLink = `edutracker://tasks/${subId}`

        // Create web notification in MongoDB
        try {
          await Notification.create({
            user: owner._id,
            type: 'task_assigned',
            task: sub._id || subId,
            channel: 'web',
            status: 'queued',
            recipient: owner.email || 'web',
            idempotencyKey: `web:assign:${subId}:${owner._id}`,
            providerPayload: {
              title,
              body,
              taskId: subId,
              taskTitle: sub.title,
              deepLink,
              type: 'task_assigned',
            },
          })
        } catch (dbErr: any) {}

        const ownerJobData: TaskAssignmentJobData = {
          userId: ownerIdStr,
          recipient: owner.email,
          taskId: subId,
          taskTitle: sub.title,
          employeeName: owner.name,
          roleInTask: 'owner',
          notificationType: 'task_assigned',
          title,
          body,
          deepLink,
          due: sub.due || parentTask.due || '',
          priority: sub.priority || parentTask.priority || 'normal',
        }

        await enqueueJob(
          QUEUE_NAMES.TASK_ASSIGNMENT,
          `assign:${subId}:${owner._id}`,
          ownerJobData,
          {
            jobId: `assign:${subId}:${owner._id}`,
          },
        )
      } else {
        await Notification.create({
          user: owner._id,
          type: 'task_assigned',
          task: sub._id || subId,
          channel: 'push',
          status: 'skipped',
          recipient: owner.email || 'unknown',
          error: 'USER_INACTIVE',
          idempotencyKey: `skip:assign:${subId}:${owner._id}`,
        })
      }
    }
  },

  /**
   * Triggers notifications when an additional subtask is added to an existing parent task.
   */
  async handleSubtaskAdded(
    parentTask: any,
    newSubtask: any,
    creatorUser?: { id: string; name?: string },
  ): Promise<void> {
    const parentId = (parentTask.id || parentTask._id).toString()
    const subId = (newSubtask.id || newSubtask._id).toString()
    const creatorId = creatorUser ? creatorUser.id.toString() : null

    // 1. Notify the newly assigned employee
    const rawOwnerId = newSubtask.owner ? (newSubtask.owner._id || newSubtask.owner) : null
    let owner: (IUser & { _id: mongoose.Types.ObjectId }) | null = null
    if (rawOwnerId && mongoose.Types.ObjectId.isValid(rawOwnerId)) {
      owner = (await User.findById(rawOwnerId).exec()) as any
    }

    if (owner && owner.isActive && owner._id.toString() !== creatorId) {
      const title = 'New Task Assigned'
      const body = `You have been assigned ${newSubtask.title}.`
      const deepLink = `edutracker://tasks/${subId}`

      try {
        await Notification.create({
          user: owner._id,
          type: 'task_assigned',
          task: newSubtask._id || subId,
          channel: 'web',
          status: 'queued',
          recipient: owner.email || 'web',
          idempotencyKey: `web:assign:${subId}:${owner._id}`,
          providerPayload: {
            title,
            body,
            taskId: subId,
            taskTitle: newSubtask.title,
            deepLink,
            type: 'task_assigned',
          },
        })
      } catch (err: any) {}

      const ownerJobData: TaskAssignmentJobData = {
        userId: owner._id.toString(),
        recipient: owner.email,
        taskId: subId,
        taskTitle: newSubtask.title,
        employeeName: owner.name,
        roleInTask: 'owner',
        notificationType: 'task_assigned',
        title,
        body,
        deepLink,
        due: newSubtask.due || parentTask.due || '',
        priority: newSubtask.priority || parentTask.priority || 'normal',
      }

      await enqueueJob(
        QUEUE_NAMES.TASK_ASSIGNMENT,
        `assign:${subId}:${owner._id}`,
        ownerJobData,
        {
          jobId: `assign:${subId}:${owner._id}`,
        },
      )
    }

    // 2. Notify the Reporting Manager about the new assignment
    const { manager } = await this.resolveReportingManager(parentTask)
    if (manager && manager.isActive && manager._id.toString() !== creatorId && manager._id.toString() !== owner?._id.toString()) {
      const title = 'New Assignment Added'
      const body = `${owner ? owner.name : 'An employee'} was assigned to ${newSubtask.title} under ${parentTask.title}.`
      const deepLink = `edutracker://tasks/${parentId}`

      try {
        await Notification.create({
          user: manager._id,
          type: 'task_supervised',
          task: parentTask._id || parentId,
          channel: 'web',
          status: 'queued',
          recipient: manager.email || 'web',
          idempotencyKey: `web:supervise_add:${subId}:${manager._id}`,
          providerPayload: {
            title,
            body,
            taskId: parentId,
            taskTitle: parentTask.title,
            deepLink,
            type: 'task_supervised',
          },
        })
      } catch (err: any) {}

      const managerJobData: TaskAssignmentJobData = {
        userId: manager._id.toString(),
        recipient: manager.email,
        taskId: parentId,
        taskTitle: parentTask.title,
        employeeName: owner ? owner.name : 'An employee',
        roleInTask: 'manager',
        notificationType: 'task_supervised',
        title,
        body,
        deepLink,
        due: newSubtask.due || parentTask.due || '',
        priority: newSubtask.priority || parentTask.priority || 'normal',
      }

      await enqueueJob(
        QUEUE_NAMES.TASK_ASSIGNMENT,
        `supervise_subtask_add:${subId}:${manager._id}`,
        managerJobData,
        {
          jobId: `supervise_subtask_add:${subId}:${manager._id}`,
        },
      )
    }
  },

  /**
   * Triggers notifications on task reassignment (owner or reportingManager changed).
   */
  async handleTaskReassigned(
    task: any,
    changes: {
      owner?: { from: string; to: string }
      reportingManager?: { from: string; to: string }
    },
  ): Promise<void> {
    const taskId = (task.id || task._id).toString()

    // Case B: Task Owner changed
    if (changes.owner) {
      const newOwnerId = changes.owner.to
      const newOwner = (await User.findById(newOwnerId).exec()) as (IUser & { _id: mongoose.Types.ObjectId }) | null

      if (newOwner && newOwner.isActive) {
        const title = 'New Task Assigned'
        const body = `You have been assigned a task: ${task.title}.`
        const deepLink = `edutracker://tasks/${taskId}`

        try {
          await Notification.create({
            user: newOwner._id,
            type: 'task_assigned',
            task: task._id || taskId,
            channel: 'web',
            status: 'queued',
            recipient: newOwner.email || 'web',
            idempotencyKey: `web:reassign:${taskId}:${newOwner._id}`,
            providerPayload: {
              title,
              body,
              taskId,
              taskTitle: task.title,
              deepLink,
              type: 'task_assigned',
            },
          })
        } catch (dbErr: any) {}

        // Notify new owner
        await enqueueJob(
          QUEUE_NAMES.TASK_ASSIGNMENT,
          `assign_reassign:${taskId}:${newOwner._id}`,
          {
            userId: newOwner._id.toString(),
            recipient: newOwner.email,
            taskId,
            taskTitle: task.title,
            employeeName: newOwner.name,
            roleInTask: 'owner',
            notificationType: 'task_assigned',
            title,
            body,
            deepLink,
            due: task.due || '',
            priority: task.priority || 'normal',
          },
          {
            jobId: `assign_reassign:${taskId}:${newOwner._id}`,
          },
        )

        // Notify reporting manager about the reassignment
        const { manager } = await this.resolveReportingManager(task)
        if (manager && manager.isActive && manager._id.toString() !== newOwner._id.toString()) {
          const mgrTitle = 'Task Reassigned'
          const mgrBody = `${task.title} has been reassigned to ${newOwner.name}.`

          try {
            await Notification.create({
              user: manager._id,
              type: 'task_reassigned',
              task: task._id || taskId,
              channel: 'web',
              status: 'queued',
              recipient: manager.email || 'web',
              idempotencyKey: `web:supervise_reassign:${taskId}:${manager._id}`,
              providerPayload: {
                title: mgrTitle,
                body: mgrBody,
                taskId,
                taskTitle: task.title,
                deepLink,
                type: 'task_reassigned',
              },
            })
          } catch (dbErr: any) {}

          await enqueueJob(
            QUEUE_NAMES.TASK_ASSIGNMENT,
            `supervise_reassign:${taskId}:${manager._id}`,
            {
              userId: manager._id.toString(),
              recipient: manager.email,
              taskId,
              taskTitle: task.title,
              employeeName: newOwner.name,
              roleInTask: 'manager',
              notificationType: 'task_reassigned',
              title: mgrTitle,
              body: mgrBody,
              deepLink,
              due: task.due || '',
              priority: task.priority || 'normal',
            },
            {
              jobId: `supervise_reassign:${taskId}:${manager._id}`,
            },
          )
        }
      }
    } else if (changes.reportingManager) {
      // Case C: Only Reporting Manager changed
      const newManagerId = changes.reportingManager.to
      const newManager = (await User.findById(newManagerId).exec()) as (IUser & { _id: mongoose.Types.ObjectId }) | null

      const currentOwnerId = task.owner ? task.owner._id || task.owner : null
      const owner = currentOwnerId ? await User.findById(currentOwnerId).exec() : null
      const ownerName = owner ? owner.name : 'An employee'

      if (newManager && newManager.isActive && newManager._id.toString() !== currentOwnerId?.toString()) {
        const mgrTitle = 'New Task Under Your Supervision'
        const mgrBody = `${ownerName} has been assigned: ${task.title}.`
        const deepLink = `edutracker://tasks/${taskId}`

        try {
          await Notification.create({
            user: newManager._id,
            type: 'task_supervised',
            task: task._id || taskId,
            channel: 'web',
            status: 'queued',
            recipient: newManager.email || 'web',
            idempotencyKey: `web:supervise_new:${taskId}:${newManager._id}`,
            providerPayload: {
              title: mgrTitle,
              body: mgrBody,
              taskId,
              taskTitle: task.title,
              deepLink,
              type: 'task_supervised',
            },
          })
        } catch (dbErr: any) {}

        await enqueueJob(
          QUEUE_NAMES.TASK_ASSIGNMENT,
          `supervise_new:${taskId}:${newManager._id}`,
          {
            userId: newManager._id.toString(),
            recipient: newManager.email,
            taskId,
            taskTitle: task.title,
            employeeName: ownerName,
            roleInTask: 'manager',
            notificationType: 'task_supervised',
            title: mgrTitle,
            body: mgrBody,
            deepLink,
            due: task.due || '',
            priority: task.priority || 'normal',
          },
          {
            jobId: `supervise_new:${taskId}:${newManager._id}`,
          },
        )
      }
    }
  },

  /**
   * Triggers notifications when a task is completed.
   * Notifies:
   * 1. Super Admin(s)
   * 2. Reporting Manager
   * 3. Task Owner (if completed by someone else)
   * Excludes the completer (no self-notifications).
   */
  async handleTaskCompleted(
    task: any,
    completedBy: { id: string; name: string },
  ): Promise<void> {
    const taskId = (task.id || task._id).toString()
    const taskTitle = task.title || 'Task'
    const completerId = completedBy.id.toString()

    const recipientMap = new Map<string, IUser & { _id: mongoose.Types.ObjectId }>()

    // 1. Fetch Super Admin(s)
    try {
      const superAdminRole = await Role.findOne({ name: 'Super Admin' }).exec()
      if (superAdminRole) {
        const superAdmins = (await User.find({
          role: superAdminRole._id,
          isActive: true,
        }).exec()) as (IUser & { _id: mongoose.Types.ObjectId })[]

        for (const sa of superAdmins) {
          if (sa._id.toString() !== completerId) {
            recipientMap.set(sa._id.toString(), sa)
          }
        }
      }
    } catch (err: any) {
      console.warn('[TASK_COMPLETED_NOTIF] Error fetching super admins:', err.message)
    }

    // 2. Fetch Reporting Manager
    try {
      const { manager } = await this.resolveReportingManager(task)
      if (manager && manager.isActive && manager._id.toString() !== completerId) {
        recipientMap.set(manager._id.toString(), manager)
      }
    } catch (err: any) {
      console.warn('[TASK_COMPLETED_NOTIF] Error resolving reporting manager:', err.message)
    }

    // 3. Fetch Task Owner (if not the completer)
    try {
      const rawOwnerId = task.owner ? task.owner._id || task.owner : null
      if (rawOwnerId && mongoose.Types.ObjectId.isValid(rawOwnerId)) {
        const ownerIdStr = rawOwnerId.toString()
        if (ownerIdStr !== completerId && !recipientMap.has(ownerIdStr)) {
          const owner = (await User.findById(rawOwnerId).exec()) as
            | (IUser & { _id: mongoose.Types.ObjectId })
            | null
          if (owner && owner.isActive) {
            recipientMap.set(ownerIdStr, owner)
          }
        }
      }
    } catch (err: any) {
      console.warn('[TASK_COMPLETED_NOTIF] Error fetching task owner:', err.message)
    }

    if (recipientMap.size === 0) {
      return
    }

    const title = `Task Completed: ${taskTitle}`
    const body = `${completedBy.name} marked "${taskTitle}" as completed.`
    const deepLink = `edutracker://tasks/${taskId}`

    for (const recipient of recipientMap.values()) {
      const recipientIdStr = recipient._id.toString()

      // Create durable web notification in MongoDB
      try {
        const idempotencyKey = `notif:completed:${taskId}:${recipientIdStr}:${Date.now()}`
        await Notification.create({
          user: recipient._id,
          type: 'task_completed',
          task: task._id || taskId,
          channel: 'web',
          status: 'queued',
          recipient: recipient.email || 'web',
          idempotencyKey,
          providerPayload: {
            title,
            body,
            completedBy: completedBy.name,
            completedById: completerId,
            taskId,
            taskTitle,
            deepLink,
            type: 'task_completed',
          },
        })
      } catch (dbErr: any) {
        console.error(`[TASK_COMPLETED_NOTIF] Failed creating web notification for ${recipient.email}:`, dbErr.message)
      }

      // Enqueue push notification job via BullMQ
      try {
        const pushTokens = recipient.pushTokens || []
        await enqueueJob(
          QUEUE_NAMES.PUSH_NOTIFICATIONS,
          `completed_push:${taskId}:${recipientIdStr}`,
          {
            type: 'task_completed',
            userId: recipientIdStr,
            recipient: recipient.email,
            taskId,
            taskTitle,
            title,
            body,
            to: pushTokens,
            deepLink,
          },
          {
            jobId: `completed_push:${taskId}:${recipientIdStr}:${Date.now()}`,
          },
        )
      } catch (queueErr: any) {
        console.warn(`[TASK_COMPLETED_NOTIF] Push enqueue warning for ${recipient.email}:`, queueErr.message)
      }
    }
  },
}

