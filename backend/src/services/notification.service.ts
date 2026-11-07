import mongoose from 'mongoose'
import { User, type IUser } from '../models/User.js'
import { Team, type ITeam } from '../models/Team.js'
import { Task, type ITask } from '../models/Task.js'
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
            title: 'New Task Assigned',
            body: `You have been assigned a task: ${task.title}.`,
            deepLink: `edutracker://tasks/${taskId}`,
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
              title: 'Task Reassigned',
              body: `${task.title} has been reassigned to ${newOwner.name}.`,
              deepLink: `edutracker://tasks/${taskId}`,
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
            title: 'New Task Under Your Supervision',
            body: `${ownerName} has been assigned: ${task.title}.`,
            deepLink: `edutracker://tasks/${taskId}`,
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
}

