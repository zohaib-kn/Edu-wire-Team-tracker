import mongoose from 'mongoose'
import { Task, type ITask } from '../../models/Task.js'
import { Activity, type IActivity } from '../../models/Activity.js'
import { Team, type ITeam } from '../../models/Team.js'
import { Branch, type IBranch } from '../../models/Branch.js'
import { User, type IUser } from '../../models/User.js'
import { Role, type IRole } from '../../models/Role.js'
import { permissionsService } from '../../services/permissions.service.js'
import { notificationService } from '../../services/notification.service.js'
import { AppError } from '../../utils/AppError.js'
import { getTodayDateIST } from '../../utils/dateUtils.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'
import type {
  CreateSubtaskInput,
  CreateTaskInput,
  TaskQueryInput,
  UpdateTaskInput,
} from './task.schemas.js'

export interface FormattedSubtaskItem {
  id: string
  title: string
  owner: string
  ownerId: string
  responsibilityLabel?: string | null
  note?: string
  due: string
  priority: 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
  isRequired: boolean
  doneAt?: string | null
  createdAt?: string
}

export interface TaskProgressSummary {
  totalSubtasks: number
  completedSubtasks: number
  pendingSubtasks: number
  requiredSubtasks: number
  completedRequiredSubtasks: number
  progressPercentage: number
}

export interface FormattedParentRef {
  id: string
  title: string
  due: string
  priority: 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
}

export interface FormattedTask {
  id: string
  title: string
  note?: string
  team: string
  teamId: string
  branch: string
  branchId: string
  owner: string
  ownerId: string
  reportingManager?: string
  reportingManagerId?: string
  createdBy: string
  createdById: string
  due: string
  priority: 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
  taskLevel: 'standalone' | 'parent' | 'subtask'
  parentTask?: FormattedParentRef | string | null
  parentTaskId?: string | null
  responsibilityLabel?: string | null
  isRequired?: boolean
  subtasks?: FormattedSubtaskItem[]
  progress?: TaskProgressSummary
  doneAt?: string | null
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
  activity?: FormattedActivity[]
}

export interface FormattedActivity {
  id: string
  taskId: string
  action: 'created' | 'edited' | 'status_changed' | 'deleted'
  user: string
  timestamp: string
  from?: unknown
  to?: unknown
  details?: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getParentTaskId(parentTask: any): mongoose.Types.ObjectId | null {
  if (!parentTask) return null
  if (parentTask._id) return parentTask._id
  if (mongoose.Types.ObjectId.isValid(parentTask)) {
    return new mongoose.Types.ObjectId(parentTask)
  }
  return null
}

export function calculateTaskProgress(subtasks: ITask[]): TaskProgressSummary {
  const nonDeleted = subtasks.filter((s) => s.deletedAt === null)
  const totalSubtasks = nonDeleted.length
  const completedSubtasks = nonDeleted.filter((s) => s.status === 'done').length
  const pendingSubtasks = totalSubtasks - completedSubtasks

  const requiredList = nonDeleted.filter((s) => s.isRequired !== false)
  const requiredSubtasks = requiredList.length
  const completedRequiredSubtasks = requiredList.filter((s) => s.status === 'done').length

  let progressPercentage = 0
  if (requiredSubtasks > 0) {
    progressPercentage = Math.round((completedRequiredSubtasks / requiredSubtasks) * 100)
  } else if (totalSubtasks > 0) {
    progressPercentage = Math.round((completedSubtasks / totalSubtasks) * 100)
  }

  return {
    totalSubtasks,
    completedSubtasks,
    pendingSubtasks,
    requiredSubtasks,
    completedRequiredSubtasks,
    progressPercentage,
  }
}

export async function syncParentStatusFromSubtasks(
  parentTaskId: string | mongoose.Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<ITask | null> {
  const parent = await Task.findById(parentTaskId).session(session || null).exec()
  if (!parent || parent.deletedAt !== null) return null

  const subtasks = await Task.find({
    parentTask: parent._id,
    deletedAt: null,
  })
    .session(session || null)
    .exec()

  if (subtasks.length === 0) {
    return parent
  }

  const requiredSubtasks = subtasks.filter((s) => s.isRequired !== false)

  let targetStatus: 'todo' | 'doing' | 'done' = 'todo'
  let targetDoneAt: Date | null = null

  if (requiredSubtasks.length === 0) {
    // If zero required subtasks, do not let parent become Done automatically
    const anyStarted = subtasks.some((s) => s.status === 'doing' || s.status === 'done')
    targetStatus = anyStarted ? 'doing' : 'todo'
    targetDoneAt = null
  } else {
    const allRequiredDone = requiredSubtasks.every((s) => s.status === 'done')
    const anyRequiredStarted = requiredSubtasks.some((s) => s.status === 'doing' || s.status === 'done')

    if (allRequiredDone) {
      targetStatus = 'done'
      targetDoneAt = parent.doneAt || new Date()
    } else if (anyRequiredStarted) {
      targetStatus = 'doing'
      targetDoneAt = null
    } else {
      targetStatus = 'todo'
      targetDoneAt = null
    }
  }

  const oldStatus = parent.status
  if (oldStatus !== targetStatus) {
    parent.status = targetStatus
    parent.doneAt = targetDoneAt
    await parent.save({ session })

    const creatorId =
      parent.createdBy && typeof parent.createdBy === 'object' && '_id' in (parent.createdBy as any)
        ? (parent.createdBy as any)._id
        : parent.createdBy

    await Activity.create({
      task: parent._id,
      user: creatorId,
      action: 'status_changed',
      from: oldStatus,
      to: targetStatus,
      at: new Date(),
    })

    if (targetStatus === 'done' && oldStatus !== 'done') {
      try {
        const creatorDoc = (await User.findById(parent.createdBy).exec()) as any
        await notificationService.handleTaskCompleted(parent, {
          id: parent.createdBy.toString(),
          name: creatorDoc?.name || 'System',
        })
      } catch (notifErr: any) {
        console.warn('[PARENT_SYNC] Notification warning on task completion:', notifErr.message)
      }
    }
  }

  return parent
}

function formatSubtaskItem(subtask: ITask): FormattedSubtaskItem {
  const ownerDoc = subtask.owner as unknown as IUser
  const ownerName = ownerDoc && typeof ownerDoc === 'object' && 'name' in ownerDoc
    ? ownerDoc.name
    : subtask.owner?.toString() || 'Unassigned'
  const ownerId = ownerDoc && typeof ownerDoc === 'object' && '_id' in ownerDoc
    ? ownerDoc._id.toString()
    : subtask.owner?.toString() || ''

  return {
    id: subtask._id.toString(),
    title: subtask.title,
    owner: ownerName,
    ownerId,
    responsibilityLabel: subtask.responsibilityLabel || null,
    note: subtask.note || '',
    due: subtask.due,
    priority: subtask.priority,
    status: subtask.status,
    isRequired: subtask.isRequired !== false,
    doneAt: subtask.doneAt ? subtask.doneAt.toISOString() : null,
    createdAt: subtask.createdAt ? subtask.createdAt.toISOString() : undefined,
  }
}

function formatActivity(activity: IActivity): FormattedActivity {
  const userDoc = activity.user as unknown as IUser
  const userName = userDoc && typeof userDoc === 'object' && 'name' in userDoc
    ? userDoc.name
    : activity.user.toString()

  let details = ''
  if (activity.action === 'status_changed') {
    details = `Status changed from ${activity.from} to ${activity.to}`
  } else if (activity.action === 'created') {
    details = 'Task created'
  } else if (activity.action === 'deleted') {
    details = 'Task deleted'
  } else if (activity.action === 'edited') {
    if (activity.from && typeof activity.from === 'object' && 'reportingManager' in (activity.from as any)) {
      details = 'Reporting manager updated'
    } else {
      details = 'Task details updated'
    }
  }

  return {
    id: activity._id.toString(),
    taskId: activity.task ? activity.task.toString() : '',
    action: activity.action as any,
    user: userName,
    timestamp: activity.at ? activity.at.toISOString() : new Date().toISOString(),
    from: activity.from,
    to: activity.to,
    details,
  }
}

function formatTask(task: ITask, activities?: IActivity[], subtasks?: ITask[]): FormattedTask {
  const teamDoc = task.team as unknown as ITeam
  const branchDoc = task.branch as unknown as IBranch
  const ownerDoc = task.owner as unknown as IUser
  const managerDoc = task.reportingManager as unknown as IUser | null
  const creatorDoc = task.createdBy as unknown as IUser

  const teamName = teamDoc && typeof teamDoc === 'object' && 'name' in teamDoc
    ? teamDoc.name
    : task.team?.toString() || 'Unassigned Team'

  const branchName = branchDoc && typeof branchDoc === 'object' && 'name' in branchDoc
    ? branchDoc.name
    : task.branch?.toString() || 'Headquarters / All'

  const ownerName = ownerDoc && typeof ownerDoc === 'object' && 'name' in ownerDoc
    ? ownerDoc.name
    : task.owner?.toString() || 'Unassigned'

  const managerName = managerDoc && typeof managerDoc === 'object' && 'name' in managerDoc
    ? managerDoc.name
    : task.reportingManager ? task.reportingManager.toString() : undefined

  const managerId = managerDoc && typeof managerDoc === 'object' && '_id' in managerDoc
    ? managerDoc._id.toString()
    : task.reportingManager ? task.reportingManager.toString() : undefined

  const creatorName = creatorDoc && typeof creatorDoc === 'object' && 'name' in creatorDoc
    ? creatorDoc.name
    : task.createdBy?.toString() || 'System'

  const taskLevel = task.taskLevel || (task.parentTask ? 'subtask' : 'standalone')

  let parentTaskRef: FormattedParentRef | string | null = null
  let parentTaskId: string | null = null

  if (task.parentTask) {
    const p: any = task.parentTask
    const pid: string = p && p._id ? p._id.toString() : String(p)
    parentTaskId = pid
    if (p && typeof p === 'object' && 'title' in p) {
      parentTaskRef = {
        id: pid,
        title: p.title || 'Parent Task',
        due: p.due || '',
        priority: p.priority || 'normal',
        status: p.status || 'todo',
      }
    } else {
      parentTaskRef = pid
    }
  }

  let formattedSubtasks: FormattedSubtaskItem[] | undefined
  let progress: TaskProgressSummary | undefined

  if (taskLevel === 'parent' || (subtasks && subtasks.length > 0)) {
    formattedSubtasks = (subtasks || []).map(formatSubtaskItem)
    progress = calculateTaskProgress(subtasks || [])
  }

  return {
    id: task._id.toString(),
    title: task.title,
    note: task.note || '',
    team: teamName,
    teamId: (task.team && typeof task.team === 'object' && '_id' in task.team ? task.team._id : task.team).toString(),
    branch: branchName,
    branchId: (task.branch && typeof task.branch === 'object' && '_id' in task.branch ? task.branch._id : task.branch).toString(),
    owner: ownerName,
    ownerId: (task.owner && typeof task.owner === 'object' && '_id' in task.owner ? task.owner._id : task.owner).toString(),
    reportingManager: managerName,
    reportingManagerId: managerId,
    createdBy: creatorName,
    createdById: (task.createdBy && typeof task.createdBy === 'object' && '_id' in task.createdBy ? task.createdBy._id : task.createdBy).toString(),
    due: task.due,
    priority: task.priority,
    status: task.status,
    taskLevel,
    parentTask: parentTaskRef,
    parentTaskId,
    responsibilityLabel: task.responsibilityLabel || null,
    isRequired: task.isRequired !== false,
    subtasks: formattedSubtasks,
    progress,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
    deletedAt: task.deletedAt ? task.deletedAt.toISOString() : null,
    createdAt: task.createdAt ? task.createdAt.toISOString() : undefined,
    updatedAt: task.updatedAt ? task.updatedAt.toISOString() : undefined,
    activity: activities ? activities.map(formatActivity) : undefined,
  }
}

export const taskService = {
  /**
   * Creates a new task with strict scope and assignment validation.
   * Supports both standalone single-assignee tasks and multi-assignee parent tasks.
   */
  async createTask(
    input: CreateTaskInput,
    user: AuthenticatedUserContext,
  ): Promise<FormattedTask> {
    // 1. Resolve Team
    let teamDoc: (ITeam & { _id: mongoose.Types.ObjectId; branch: any }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.team)) {
      teamDoc = (await Team.findById(input.team).exec()) as any
    }
    if (!teamDoc) {
      teamDoc = (await Team.findOne({ name: input.team }).exec()) as any
    }
    if (!teamDoc || !teamDoc.isActive) {
      throw AppError.badRequest('Selected team does not exist or is inactive', 'TEAM_NOT_FOUND')
    }

    // 2. Resolve Team Lead / Default Reporting Manager for teamDoc
    let defaultTeamLead: (IUser & { _id: mongoose.Types.ObjectId; role: any; branch: any }) | null = null
    if (teamDoc.lead) {
      defaultTeamLead = (await User.findById(teamDoc.lead).populate('role').exec()) as any
      if (defaultTeamLead && !defaultTeamLead.isActive) {
        defaultTeamLead = null
      }
    }
    if (!defaultTeamLead) {
      const teamLeadRole = await Role.findOne({ name: 'Team Lead' }).exec()
      if (teamLeadRole) {
        defaultTeamLead = (await User.findOne({
          role: teamLeadRole._id,
          teams: teamDoc._id,
          isActive: true,
        }).populate('role').exec()) as any
      }
    }

    // 3. Resolve final Reporting Manager
    let finalReportingManagerId: mongoose.Types.ObjectId | null = null
    let reportingManagerDoc: (IUser & { _id: mongoose.Types.ObjectId; role: any; branch: any }) | null = null

    if (input.reportingManager && input.reportingManager.trim()) {
      const requested = input.reportingManager.trim()
      let candidateManager: (IUser & { _id: mongoose.Types.ObjectId; role: any; branch: any }) | null = null
      if (mongoose.Types.ObjectId.isValid(requested)) {
        candidateManager = (await User.findById(requested).populate('role').exec()) as any
      }
      if (!candidateManager) {
        candidateManager = (await User.findOne({
          $or: [{ email: requested.toLowerCase() }, { name: requested }],
        }).populate('role').exec()) as any
      }

      if (!candidateManager || !candidateManager.isActive) {
        throw AppError.badRequest('Selected reporting manager does not exist or is inactive', 'INVALID_REPORTING_MANAGER')
      }

      // Check if non-super-admin is attempting unauthorized override
      const isDefaultLead = defaultTeamLead && defaultTeamLead._id.toString() === candidateManager._id.toString()
      if (!isDefaultLead && user.role !== 'Super Admin') {
        throw AppError.forbidden(
          'Only Super Admin can override the reporting manager outside the default team-lead relationship',
          'UNAUTHORIZED_OVERRIDE',
        )
      }

      // Branch match check: candidate manager must belong to same branch as task/team
      const candidateBranchId = candidateManager.branch
        ? (candidateManager.branch._id ? candidateManager.branch._id.toString() : candidateManager.branch.toString())
        : ''
      const teamBranchId = teamDoc.branch
        ? (teamDoc.branch._id ? teamDoc.branch._id.toString() : teamDoc.branch.toString())
        : ''
      if (!candidateBranchId || candidateBranchId !== teamBranchId) {
        throw AppError.badRequest('Reporting manager must belong to the same branch as the task', 'MANAGER_BRANCH_MISMATCH')
      }

      // Supervisory eligibility check
      const candidateRole = candidateManager.role as unknown as IRole
      const roleName = candidateRole && typeof candidateRole === 'object' && 'name' in candidateRole ? candidateRole.name : ''
      if (!['Team Lead', 'Branch Admin', 'Super Admin'].includes(roleName)) {
        throw AppError.badRequest('Selected reporting manager does not have supervisory eligibility', 'INVALID_SUPERVISOR')
      }

      finalReportingManagerId = candidateManager._id
      reportingManagerDoc = candidateManager
    } else {
      // Default: use team lead
      if (defaultTeamLead && defaultTeamLead.isActive) {
        finalReportingManagerId = defaultTeamLead._id
        reportingManagerDoc = defaultTeamLead
      } else {
        throw AppError.badRequest(
          'Selected team does not have an active Team Lead. Please select an eligible reporting manager.',
          'REPORTING_MANAGER_REQUIRED',
        )
      }
    }

    // ----------------------------------------------------
    // BRANCH A: MULTI-ASSIGNEE PARENT TASK CREATION
    // ----------------------------------------------------
    if (input.subtasks && input.subtasks.length > 0) {
      // Resolve Parent Task Owner (backward-compatible: defaults to reporting manager or current user)
      let parentOwnerDoc: (IUser & { _id: mongoose.Types.ObjectId }) | null = null
      if (input.owner && input.owner.trim()) {
        if (mongoose.Types.ObjectId.isValid(input.owner)) {
          parentOwnerDoc = (await User.findById(input.owner).exec()) as any
        }
        if (!parentOwnerDoc) {
          parentOwnerDoc = (await User.findOne({
            $or: [{ email: input.owner.toLowerCase() }, { name: input.owner }],
          }).exec()) as any
        }
      }
      if (!parentOwnerDoc && reportingManagerDoc) {
        parentOwnerDoc = reportingManagerDoc
      }
      if (!parentOwnerDoc) {
        parentOwnerDoc = (await User.findById(user.id).exec()) as any
      }
      if (!parentOwnerDoc || !parentOwnerDoc.isActive) {
        throw AppError.badRequest('Unable to resolve active parent task owner', 'PARENT_OWNER_REQUIRED')
      }

      // Verify user has task.create authorization for parent
      const isAuthorized = permissionsService.can(user, 'task.create', {
        teamId: teamDoc._id,
        branchId: teamDoc.branch,
        ownerId: parentOwnerDoc._id,
        createdById: user.id,
      })
      if (!isAuthorized) {
        throw AppError.forbidden(
          'You do not have permission to create or assign tasks for this team.',
          'INSUFFICIENT_SCOPE',
        )
      }

      // Pre-validate all subtasks before creating any records
      const seenAssignees = new Set<string>()
      const resolvedSubtasks: Array<{
        title: string
        note?: string
        due: string
        priority: 'normal' | 'high'
        responsibilityLabel?: string | null
        isRequired: boolean
        ownerDoc: IUser & { _id: mongoose.Types.ObjectId }
      }> = []

      for (const st of input.subtasks) {
        let subOwner: (IUser & { _id: mongoose.Types.ObjectId; branch: any; teams: any }) | null = null
        if (mongoose.Types.ObjectId.isValid(st.owner)) {
          subOwner = (await User.findById(st.owner).exec()) as any
        }
        if (!subOwner) {
          subOwner = (await User.findOne({
            $or: [{ email: st.owner.toLowerCase() }, { name: st.owner }],
          }).exec()) as any
        }
        if (!subOwner || !subOwner.isActive) {
          throw AppError.badRequest(`Subtask assignee '${st.owner}' does not exist or is inactive`, 'SUBTASK_OWNER_NOT_FOUND')
        }

        // Verify Owner belongs to parent's Team
        const belongsToTeam =
          subOwner.teams &&
          subOwner.teams.some((t: any) => t.toString() === teamDoc!._id.toString())
        if (!belongsToTeam && user.role !== 'Super Admin') {
          throw AppError.badRequest(
            `Subtask assignee '${subOwner.name}' does not belong to team '${teamDoc.name}'`,
            'INVALID_TEAM_ASSIGNMENT',
          )
        }

        // Verify Owner belongs to same Branch as team
        const subOwnerBranchId = subOwner.branch
          ? (subOwner.branch._id ? subOwner.branch._id.toString() : subOwner.branch.toString())
          : ''
        const teamBranchId = teamDoc.branch
          ? (teamDoc.branch._id ? teamDoc.branch._id.toString() : teamDoc.branch.toString())
          : ''
        if (subOwnerBranchId && teamBranchId && subOwnerBranchId !== teamBranchId) {
          throw AppError.badRequest(
            `Subtask assignee '${subOwner.name}' does not belong to the same branch as the team`,
            'CROSS_BRANCH_ASSIGNMENT',
          )
        }

        // Check duplicate assignee under this parent in V1 workflow
        const subOwnerIdStr = subOwner._id.toString()
        if (seenAssignees.has(subOwnerIdStr)) {
          throw AppError.badRequest(
            'Duplicate subtask assignees are not allowed under the same parent task',
            'DUPLICATE_SUBTASK_ASSIGNEE',
          )
        }
        seenAssignees.add(subOwnerIdStr)

        resolvedSubtasks.push({
          title: st.title,
          note: st.note || '',
          due: st.due || input.due,
          priority: st.priority || input.priority || 'normal',
          responsibilityLabel: st.responsibilityLabel || null,
          isRequired: st.isRequired !== false,
          ownerDoc: subOwner,
        })
      }

      // Atomic Creation with Rollback
      let parentTask: ITask | null = null
      const createdSubtasks: ITask[] = []

      try {
        parentTask = await Task.create({
          title: input.title,
          note: input.note || '',
          team: teamDoc._id,
          branch: teamDoc.branch,
          owner: parentOwnerDoc._id,
          reportingManager: finalReportingManagerId,
          createdBy: user.id,
          due: input.due,
          priority: input.priority || 'normal',
          status: 'todo',
          taskLevel: 'parent',
          parentTask: null,
          responsibilityLabel: input.responsibilityLabel || null,
          isRequired: input.isRequired !== false,
        })

        await Activity.create({
          task: parentTask._id,
          user: user.id,
          action: 'created',
          at: new Date(),
        })

        for (const st of resolvedSubtasks) {
          const subtask = await Task.create({
            title: st.title,
            note: st.note || '',
            team: teamDoc._id,
            branch: teamDoc.branch,
            owner: st.ownerDoc._id,
            reportingManager: finalReportingManagerId,
            createdBy: user.id,
            due: st.due,
            priority: st.priority,
            status: 'todo',
            taskLevel: 'subtask',
            parentTask: parentTask._id,
            responsibilityLabel: st.responsibilityLabel,
            isRequired: st.isRequired,
          })

          createdSubtasks.push(subtask)

          await Activity.create({
            task: subtask._id,
            user: user.id,
            action: 'created',
            at: new Date(),
          })
        }

        // Recalculate parent status from subtasks
        await syncParentStatusFromSubtasks(parentTask._id)

        // Notifications: Assignees receive individual subtask alerts; Reporting Manager receives overall supervision alert
        try {
          await notificationService.handleParentTaskCreated(parentTask, createdSubtasks, user)
        } catch (notifErr: any) {
          console.warn('[TASK_SERVICE] Parent task notification warning:', notifErr.message)
        }
      } catch (creationError) {
        // Rollback created documents
        if (parentTask) {
          try {
            const taskIdsToDelete = [parentTask._id, ...createdSubtasks.map((s) => s._id)]
            await Task.deleteMany({ _id: { $in: taskIdsToDelete } })
            await Activity.deleteMany({ task: { $in: taskIdsToDelete } })
          } catch (cleanupErr) {
            console.error('[TASK_SERVICE] Rollback cleanup error:', cleanupErr)
          }
        }
        throw creationError
      }

      // Populate and return parent with subtasks
      const populatedParent = await Task.findById(parentTask._id)
        .populate('team')
        .populate('branch')
        .populate('owner')
        .populate('reportingManager')
        .populate('createdBy')
        .exec()

      const populatedSubtasks = await Task.find({
        parentTask: parentTask._id,
        deletedAt: null,
      })
        .populate('owner')
        .exec()

      return formatTask(populatedParent!, undefined, populatedSubtasks)
    }

    // ----------------------------------------------------
    // BRANCH B: STANDALONE SINGLE-ASSIGNEE TASK CREATION
    // ----------------------------------------------------
    if (!input.owner || !input.owner.trim()) {
      throw AppError.badRequest('Assigned owner is required for standalone tasks', 'OWNER_REQUIRED')
    }

    let ownerDoc: (IUser & { _id: mongoose.Types.ObjectId }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.owner)) {
      ownerDoc = (await User.findById(input.owner).exec()) as any
    }
    if (!ownerDoc) {
      ownerDoc = (await User.findOne({
        $or: [
          { email: input.owner.toLowerCase() },
          { name: input.owner },
        ],
      }).exec()) as any
    }
    if (!ownerDoc || !ownerDoc.isActive) {
      throw AppError.badRequest('Selected task owner does not exist or is inactive', 'OWNER_NOT_FOUND')
    }

    // Verify Owner belongs to Team
    const belongsToTeam =
      ownerDoc.teams &&
      ownerDoc.teams.some((t) => t.toString() === teamDoc!._id.toString())

    if (!belongsToTeam && user.role !== 'Super Admin') {
      throw AppError.badRequest(
        `Selected owner '${ownerDoc.name}' does not belong to team '${teamDoc.name}'`,
        'INVALID_TEAM_ASSIGNMENT',
      )
    }

    // Self-reporting check for standalone tasks
    if (finalReportingManagerId && finalReportingManagerId.toString() === ownerDoc._id.toString()) {
      throw AppError.badRequest(
        'An employee cannot be assigned as their own reporting manager',
        'SELF_REPORTING_NOT_ALLOWED',
      )
    }

    // Verify user has task.create authorization for this scope
    const isAuthorized = permissionsService.can(user, 'task.create', {
      teamId: teamDoc._id,
      branchId: teamDoc.branch,
      ownerId: ownerDoc._id,
      createdById: user.id,
    })

    if (!isAuthorized) {
      throw AppError.forbidden(
        'You do not have permission to create or assign tasks for this team or owner.',
        'INSUFFICIENT_SCOPE',
      )
    }

    // Create standalone task in MongoDB
    const newTask = await Task.create({
      title: input.title,
      note: input.note || '',
      team: teamDoc._id,
      branch: teamDoc.branch,
      owner: ownerDoc._id,
      reportingManager: finalReportingManagerId,
      createdBy: user.id,
      due: input.due,
      priority: input.priority || 'normal',
      status: 'todo',
      taskLevel: 'standalone',
      parentTask: null,
      responsibilityLabel: input.responsibilityLabel || null,
      isRequired: input.isRequired !== false,
    })

    // Record Activity
    await Activity.create({
      task: newTask._id,
      user: user.id,
      action: 'created',
      at: new Date(),
    })

    // Safe durable notification triggering
    try {
      await notificationService.handleTaskCreated(newTask)
    } catch (notifErr: any) {
      console.warn('[TASK_SERVICE] Notification queue warning on task creation:', notifErr.message)
    }

    // Populate and return
    const populated = await Task.findById(newTask._id)
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .exec()

    return formatTask(populated!)
  },

  /**
   * Adds an individual subtask to an existing task.
   * Promotes standalone task to parent task if necessary.
   */
  async createSubtask(
    parentTaskId: string,
    input: CreateSubtaskInput,
    user: AuthenticatedUserContext,
  ): Promise<FormattedTask> {
    if (!mongoose.Types.ObjectId.isValid(parentTaskId)) {
      throw AppError.notFound('Invalid parent task ID', 'TASK_NOT_FOUND')
    }

    const parent = await Task.findOne({ _id: parentTaskId, deletedAt: null }).exec()
    if (!parent) {
      throw AppError.notFound('Parent task not found', 'TASK_NOT_FOUND')
    }

    if (parent.parentTask || parent.taskLevel === 'subtask') {
      throw AppError.badRequest(
        'Nested subtasks are not supported. Cannot add a subtask to another subtask.',
        'NESTED_SUBTASKS_NOT_SUPPORTED',
      )
    }

    // Permission check: user must have task.create for parent's scope
    const isAuthorized = permissionsService.can(user, 'task.create', {
      teamId: parent.team,
      branchId: parent.branch,
      reportingManagerId: parent.reportingManager,
      createdById: parent.createdBy,
    })

    if (!isAuthorized) {
      throw AppError.forbidden(
        'You do not have permission to add subtasks to this task.',
        'FORBIDDEN',
      )
    }

    // Resolve Subtask Owner
    let ownerDoc: (IUser & { _id: mongoose.Types.ObjectId; branch: any; teams: any }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.owner)) {
      ownerDoc = (await User.findById(input.owner).exec()) as any
    }
    if (!ownerDoc) {
      ownerDoc = (await User.findOne({
        $or: [{ email: input.owner.toLowerCase() }, { name: input.owner }],
      }).exec()) as any
    }
    if (!ownerDoc || !ownerDoc.isActive) {
      throw AppError.badRequest('Selected subtask owner does not exist or is inactive', 'OWNER_NOT_FOUND')
    }

    // Verify Owner belongs to parent's Team
    const belongsToTeam =
      ownerDoc.teams &&
      ownerDoc.teams.some((t: any) => t.toString() === parent.team.toString())

    if (!belongsToTeam && user.role !== 'Super Admin') {
      throw AppError.badRequest(
        `Selected subtask owner '${ownerDoc.name}' does not belong to the task's assigned team`,
        'INVALID_TEAM_ASSIGNMENT',
      )
    }

    // Verify Owner belongs to same Branch as task
    const ownerBranchId = ownerDoc.branch
      ? (ownerDoc.branch._id ? ownerDoc.branch._id.toString() : ownerDoc.branch.toString())
      : ''
    const parentBranchId = parent.branch
      ? (parent.branch._id ? parent.branch._id.toString() : parent.branch.toString())
      : ''
    if (ownerBranchId && parentBranchId && ownerBranchId !== parentBranchId) {
      throw AppError.badRequest(
        `Subtask owner '${ownerDoc.name}' does not belong to the same branch as the task`,
        'CROSS_BRANCH_ASSIGNMENT',
      )
    }

    // Check duplicate assignee under this parent
    const existingSubtask = await Task.findOne({
      parentTask: parent._id,
      owner: ownerDoc._id,
      deletedAt: null,
    }).exec()

    if (existingSubtask) {
      throw AppError.badRequest(
        `An active subtask is already assigned to '${ownerDoc.name}' under this parent task`,
        'DUPLICATE_SUBTASK_ASSIGNEE',
      )
    }

    // Promote parent if it was standalone
    if (parent.taskLevel === 'standalone') {
      parent.taskLevel = 'parent'
      await parent.save()
    }

    // Create subtask
    const newSubtask = await Task.create({
      title: input.title,
      note: input.note || '',
      team: parent.team,
      branch: parent.branch,
      owner: ownerDoc._id,
      reportingManager: parent.reportingManager,
      createdBy: user.id,
      due: input.due || parent.due,
      priority: input.priority || parent.priority || 'normal',
      status: 'todo',
      taskLevel: 'subtask',
      parentTask: parent._id,
      responsibilityLabel: input.responsibilityLabel || null,
      isRequired: input.isRequired !== false,
    })

    // Record Activity
    await Activity.create({
      task: newSubtask._id,
      user: user.id,
      action: 'created',
      at: new Date(),
    })

    await Activity.create({
      task: parent._id,
      user: user.id,
      action: 'edited',
      at: new Date(),
    })

    // Resync parent status
    await syncParentStatusFromSubtasks(parent._id)

    // Notify assignee and reporting manager
    try {
      await notificationService.handleSubtaskAdded(parent, newSubtask, user)
    } catch (notifErr: any) {
      console.warn('[TASK_SERVICE] Subtask notification warning:', notifErr.message)
    }

    // Return populated subtask
    const populated = await Task.findById(newSubtask._id)
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .populate({ path: 'parentTask', select: 'title due priority status' })
      .exec()

    return formatTask(populated!)
  },

  /**
   * Retrieves tasks scoped by user permissions and requested filters.
   */
  async getTasks(
    query: TaskQueryInput,
    user: AuthenticatedUserContext,
  ): Promise<{ tasks: FormattedTask[]; total: number; page: number; limit: number; totalPages: number }> {
    let filter: Record<string, any>

    if (query.reporting === 'me') {
      // Delegated read access: return tasks specifically supervised by current user
      filter = {
        deletedAt: null,
        reportingManager: new mongoose.Types.ObjectId(user.id),
      }
    } else {
      const scopeFilter = permissionsService.getScopeFilter(user, 'task.view')
      if (scopeFilter === null) {
        throw AppError.forbidden('Insufficient permissions to view tasks', 'FORBIDDEN')
      }

      filter = {
        deletedAt: null, // Exclude soft deleted
        ...scopeFilter,
      }
    }

    // Branch filter
    if (query.branch && query.branch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(query.branch)) {
        filter.branch = query.branch
      } else {
        const branchDoc = await Branch.findOne({ name: query.branch }).exec()
        if (branchDoc) filter.branch = branchDoc._id
      }
    }

    // Team filter
    if (query.team && query.team !== 'all') {
      if (mongoose.Types.ObjectId.isValid(query.team)) {
        filter.team = query.team
      } else {
        const teamDoc = await Team.findOne({ name: query.team }).exec()
        if (teamDoc) filter.team = teamDoc._id
      }
    }

    // Status filter
    if (query.status && query.status !== 'all') {
      if (query.status === 'done' || query.status === 'completed') {
        filter.status = 'done'
      } else if (query.status === 'pending') {
        filter.status = { $in: ['todo', 'doing'] }
      } else {
        filter.status = query.status
      }
    }

    // Owner filter
    if (query.owner) {
      if (query.owner === 'me') {
        filter.owner = user.id
      } else if (mongoose.Types.ObjectId.isValid(query.owner)) {
        filter.owner = query.owner
      }
    }

    // Explicit Reporting Manager filter (e.g. for Admin queries)
    if (query.reportingManager && query.reporting !== 'me') {
      if (mongoose.Types.ObjectId.isValid(query.reportingManager)) {
        filter.reportingManager = new mongoose.Types.ObjectId(query.reportingManager)
      }
    }

    // Parent Task filter
    if (query.parentTask !== undefined) {
      if (query.parentTask === 'null' || query.parentTask === 'none') {
        filter.parentTask = null
      } else if (mongoose.Types.ObjectId.isValid(query.parentTask)) {
        filter.parentTask = new mongoose.Types.ObjectId(query.parentTask)
      }
    }

    // Task Level filter
    if (query.taskLevel && query.taskLevel !== 'all') {
      filter.taskLevel = query.taskLevel
    }

    // Due filter (using Asia/Kolkata date)
    const todayIST = getTodayDateIST()
    if (query.due === 'today') {
      filter.due = todayIST
      filter.status = { $ne: 'done' }
    } else if (query.due === 'late') {
      filter.due = { $lt: todayIST }
      filter.status = { $ne: 'done' }
    }

    // Search query q
    if (query.q && query.q.trim()) {
      const escaped = escapeRegex(query.q.trim())
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { note: { $regex: escaped, $options: 'i' } },
      ]
    }

    const page = query.page || 1
    const limit = query.limit || 50
    const skip = (page - 1) * limit

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('team')
        .populate('branch')
        .populate('owner')
        .populate('reportingManager')
        .populate('createdBy')
        .populate({ path: 'parentTask', select: 'title due priority status' })
        .exec(),
      Task.countDocuments(filter).exec(),
    ])

    // Batch load subtasks for any parent tasks in this page
    const parentIds = tasks.filter((t) => t.taskLevel === 'parent').map((t) => t._id)
    const subtasksByParent: Record<string, ITask[]> = {}
    if (parentIds.length > 0) {
      const allChildSubtasks = await Task.find({
        parentTask: { $in: parentIds },
        deletedAt: null,
      })
        .populate('owner')
        .exec()

      for (const st of allChildSubtasks) {
        const pId = (
          st.parentTask && typeof st.parentTask === 'object' && '_id' in st.parentTask
            ? (st.parentTask as any)._id
            : st.parentTask
        ).toString()
        if (!subtasksByParent[pId]) subtasksByParent[pId] = []
        subtasksByParent[pId].push(st)
      }
    }

    return {
      tasks: tasks.map((t) => formatTask(t, undefined, subtasksByParent[t._id.toString()])),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  },

  /**
   * Fetches single task details with complete activity history.
   */
  async getTaskById(
    id: string,
    user: AuthenticatedUserContext,
  ): Promise<FormattedTask> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid task ID', 'TASK_NOT_FOUND')
    }

    const task = await Task.findOne({ _id: id, deletedAt: null })
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .populate({ path: 'parentTask', select: 'title due priority status' })
      .exec()

    if (!task) {
      throw AppError.notFound('Task not found or has been deleted', 'TASK_NOT_FOUND')
    }

    let subtasks: ITask[] = []
    let subtaskOwnerIds: string[] = []
    if (task.taskLevel === 'parent') {
      subtasks = await Task.find({ parentTask: task._id, deletedAt: null })
        .populate('owner')
        .exec()
      subtaskOwnerIds = subtasks.map((s) => {
        const o = s.owner as any
        return o && typeof o === 'object' && '_id' in o ? o._id.toString() : String(o)
      })
    }

    const isReportingManager =
      task.reportingManager &&
      (task.reportingManager as any)._id
        ? (task.reportingManager as any)._id.toString() === user.id
        : task.reportingManager?.toString() === user.id

    const isSubtaskOwner = subtaskOwnerIds.includes(user.id.toString())

    const canView =
      isReportingManager ||
      isSubtaskOwner ||
      permissionsService.can(user, 'task.view', {
        teamId: task.team,
        branchId: task.branch,
        ownerId: task.owner,
        createdById: task.createdBy,
        reportingManagerId: task.reportingManager,
        subtaskOwnerIds,
      })

    if (!canView) {
      throw AppError.forbidden('You do not have permission to view this task', 'FORBIDDEN')
    }

    const activities = await Activity.find({ task: task._id })
      .sort({ at: -1 })
      .populate('user')
      .exec()

    return formatTask(task, activities, subtasks)
  },

  /**
   * Updates task details (title, note, owner, due, priority) and records activity diff.
   */
  async updateTask(
    id: string,
    input: UpdateTaskInput,
    user: AuthenticatedUserContext,
  ): Promise<FormattedTask> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid task ID', 'TASK_NOT_FOUND')
    }

    const task = await Task.findOne({ _id: id, deletedAt: null }).exec()
    if (!task) {
      throw AppError.notFound('Task not found', 'TASK_NOT_FOUND')
    }

    const canEdit = permissionsService.can(user, 'task.edit', {
      teamId: task.team,
      branchId: task.branch,
      ownerId: task.owner,
      createdById: task.createdBy,
    })

    if (!canEdit) {
      throw AppError.forbidden('You do not have permission to edit this task', 'FORBIDDEN')
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {}

    if (input.title !== undefined && input.title !== task.title) {
      changes.title = { from: task.title, to: input.title }
      task.title = input.title
    }

    if (input.note !== undefined && input.note !== task.note) {
      changes.note = { from: task.note, to: input.note }
      task.note = input.note
    }

    if (input.due !== undefined && input.due !== task.due) {
      changes.due = { from: task.due, to: input.due }
      task.due = input.due
    }

    if (input.priority !== undefined && input.priority !== task.priority) {
      changes.priority = { from: task.priority, to: input.priority }
      task.priority = input.priority
    }

    if (input.responsibilityLabel !== undefined && input.responsibilityLabel !== task.responsibilityLabel) {
      changes.responsibilityLabel = { from: task.responsibilityLabel, to: input.responsibilityLabel }
      task.responsibilityLabel = input.responsibilityLabel
    }

    let isRequiredChanged = false
    if (input.isRequired !== undefined && input.isRequired !== task.isRequired) {
      changes.isRequired = { from: task.isRequired, to: input.isRequired }
      task.isRequired = input.isRequired
      isRequiredChanged = true
    }

    if (input.owner !== undefined) {
      let newOwner: (IUser & { _id: mongoose.Types.ObjectId }) | null = null
      if (mongoose.Types.ObjectId.isValid(input.owner)) {
        newOwner = (await User.findById(input.owner).exec()) as any
      }
      if (!newOwner) {
        newOwner = (await User.findOne({
          $or: [{ email: input.owner.toLowerCase() }, { name: input.owner }],
        }).exec()) as any
      }

      if (!newOwner || !newOwner.isActive) {
        throw AppError.badRequest('New owner does not exist or is inactive', 'OWNER_NOT_FOUND')
      }

      const belongsToTeam =
        newOwner.teams &&
        newOwner.teams.some((t) => t.toString() === task.team.toString())

      if (!belongsToTeam && user.role !== 'Super Admin') {
        throw AppError.badRequest(
          `New owner '${newOwner.name}' does not belong to this task's assigned team`,
          'INVALID_TEAM_ASSIGNMENT',
        )
      }

      // Check duplicate assignee if this is a subtask
      if (task.parentTask) {
        const existingSibling = await Task.findOne({
          parentTask: task.parentTask,
          owner: newOwner._id,
          _id: { $ne: task._id },
          deletedAt: null,
        }).exec()

        if (existingSibling) {
          throw AppError.badRequest(
            `An active subtask is already assigned to '${newOwner.name}' under this parent task`,
            'DUPLICATE_SUBTASK_ASSIGNEE',
          )
        }
      }

      // Check self-reporting against current reporting manager
      if (task.reportingManager && newOwner._id.toString() === task.reportingManager.toString()) {
        throw AppError.badRequest(
          'An employee cannot be assigned as their own reporting manager',
          'SELF_REPORTING_NOT_ALLOWED',
        )
      }

      if (newOwner._id.toString() !== task.owner.toString()) {
        changes.owner = { from: task.owner.toString(), to: newOwner._id.toString() }
        task.owner = newOwner._id
      }
    }

    if (input.reportingManager !== undefined) {
      if (user.role !== 'Super Admin') {
        throw AppError.forbidden(
          'Only Super Admin can change the reporting manager',
          'UNAUTHORIZED_OVERRIDE',
        )
      }

      const requested = input.reportingManager.trim()
      let newManager: (IUser & { _id: mongoose.Types.ObjectId; role: any }) | null = null
      if (mongoose.Types.ObjectId.isValid(requested)) {
        newManager = (await User.findById(requested).populate('role').exec()) as any
      }
      if (!newManager) {
        newManager = (await User.findOne({
          $or: [{ email: requested.toLowerCase() }, { name: requested }],
        }).populate('role').exec()) as any
      }

      if (!newManager || !newManager.isActive) {
        throw AppError.badRequest(
          'Selected reporting manager does not exist or is inactive',
          'INVALID_REPORTING_MANAGER',
        )
      }

      // Branch match check against task branch
      const managerBranchId = newManager.branch
        ? (newManager.branch._id ? newManager.branch._id.toString() : newManager.branch.toString())
        : ''
      const taskBranchId = task.branch
        ? (task.branch._id ? task.branch._id.toString() : task.branch.toString())
        : ''
      if (!managerBranchId || managerBranchId !== taskBranchId) {
        throw AppError.badRequest(
          'Reporting manager must belong to the same branch as the task',
          'MANAGER_BRANCH_MISMATCH',
        )
      }

      // Self-reporting check against current task owner
      if (newManager._id.toString() === task.owner.toString()) {
        throw AppError.badRequest(
          'An employee cannot be assigned as their own reporting manager',
          'SELF_REPORTING_NOT_ALLOWED',
        )
      }

      // Supervisory eligibility check
      const roleDoc = newManager.role as unknown as IRole
      const roleName = roleDoc && typeof roleDoc === 'object' && 'name' in roleDoc ? roleDoc.name : ''
      if (!['Team Lead', 'Branch Admin', 'Super Admin'].includes(roleName)) {
        throw AppError.badRequest(
          'Selected reporting manager does not have supervisory eligibility',
          'INVALID_SUPERVISOR',
        )
      }

      const currentManagerId = task.reportingManager
        ? (task.reportingManager._id ? task.reportingManager._id.toString() : task.reportingManager.toString())
        : null

      if (currentManagerId !== newManager._id.toString()) {
        changes.reportingManager = { from: currentManagerId, to: newManager._id.toString() }
        task.reportingManager = newManager._id
      }
    }

    // Only persist and record activity if values actually changed
    if (Object.keys(changes).length > 0) {
      await task.save()

      await Activity.create({
        task: task._id,
        user: user.id,
        action: 'edited',
        from: changes,
        to: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
        at: new Date(),
      })

      if (changes.owner || changes.reportingManager) {
        try {
          await notificationService.handleTaskReassigned(task, changes as any)
        } catch (notifErr: any) {
          console.warn('[TASK_SERVICE] Notification queue warning on task reassignment:', notifErr.message)
        }

        if (changes.reportingManager && task.taskLevel === 'parent') {
          await Task.updateMany(
            { parentTask: task._id, deletedAt: null },
            { $set: { reportingManager: task.reportingManager } },
          )
        }
      }

      // If isRequired changed on a subtask, recalculate parent status
      if (isRequiredChanged && task.parentTask) {
        const pId = getParentTaskId(task.parentTask)
        if (pId) {
          await syncParentStatusFromSubtasks(pId)
        }
      }
    }

    let subtasks: ITask[] = []
    if (task.taskLevel === 'parent') {
      subtasks = await Task.find({ parentTask: task._id, deletedAt: null }).populate('owner').exec()
    }

    const populated = await Task.findById(task._id)
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .populate({ path: 'parentTask', select: 'title due priority status' })
      .exec()

    const activities = await Activity.find({ task: task._id })
      .sort({ at: -1 })
      .populate('user')
      .exec()

    return formatTask(populated!, activities, subtasks)
  },

  /**
   * Updates task status (todo, doing, done) directly without approval.
   * Derived parent task status cannot be set manually.
   */
  async updateTaskStatus(
    id: string,
    status: 'todo' | 'doing' | 'done',
    user: AuthenticatedUserContext,
  ): Promise<FormattedTask> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid task ID', 'TASK_NOT_FOUND')
    }

    const task = await Task.findOne({ _id: id, deletedAt: null }).exec()
    if (!task) {
      throw AppError.notFound('Task not found', 'TASK_NOT_FOUND')
    }

    // Guard: Parent status is derived automatically from its subtasks
    if (task.taskLevel === 'parent') {
      throw AppError.badRequest(
        'Parent task status is automatically derived from its subtasks and cannot be updated manually',
        'PARENT_STATUS_DERIVED',
      )
    }

    // Scope check: Super Admin = all, Branch Admin = branch, Team Lead = team, Member = own
    const canChangeStatus = permissionsService.can(user, 'task.status', {
      teamId: task.team,
      branchId: task.branch,
      ownerId: task.owner,
      createdById: task.createdBy,
    })

    if (!canChangeStatus) {
      throw AppError.forbidden(
        'You do not have permission to change status for this task.',
        'FORBIDDEN',
      )
    }

    // No-op if status is unchanged
    if (task.status === status) {
      const populated = await Task.findById(task._id)
        .populate('team')
        .populate('branch')
        .populate('owner')
        .populate('reportingManager')
        .populate('createdBy')
        .populate({ path: 'parentTask', select: 'title due priority status' })
        .exec()
      return formatTask(populated!)
    }

    const oldStatus = task.status
    task.status = status

    if (status === 'done') {
      task.doneAt = new Date()
    } else if (oldStatus === 'done') {
      task.doneAt = null
    }

    await task.save()

    await Activity.create({
      task: task._id,
      user: user.id,
      action: 'status_changed',
      from: oldStatus,
      to: status,
      at: new Date(),
    })

    if (status === 'done' && oldStatus !== 'done') {
      try {
        await notificationService.handleTaskCompleted(task, { id: user.id, name: user.name })
      } catch (notifErr: any) {
        console.warn('[TASK_SERVICE] Notification warning on task completion:', notifErr.message)
      }
    }

    // Resync parent status and progress if this task is a subtask
    if (task.parentTask) {
      const pId = getParentTaskId(task.parentTask)
      if (pId) {
        await syncParentStatusFromSubtasks(pId)
      }
    }

    const populated = await Task.findById(task._id)
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .populate({ path: 'parentTask', select: 'title due priority status' })
      .exec()

    const activities = await Activity.find({ task: task._id })
      .sort({ at: -1 })
      .populate('user')
      .exec()

    return formatTask(populated!, activities)
  },

  /**
   * Soft deletes a task by setting deletedAt timestamp.
   * Soft-deleting a parent cascades to its subtasks.
   */
  async deleteTask(
    id: string,
    user: AuthenticatedUserContext,
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid task ID', 'TASK_NOT_FOUND')
    }

    const task = await Task.findOne({ _id: id, deletedAt: null }).exec()
    if (!task) {
      throw AppError.notFound('Task not found', 'TASK_NOT_FOUND')
    }

    const canDelete = permissionsService.can(user, 'task.delete', {
      teamId: task.team,
      branchId: task.branch,
      ownerId: task.owner,
      createdById: task.createdBy,
    })

    if (!canDelete) {
      throw AppError.forbidden('You do not have permission to delete this task', 'FORBIDDEN')
    }

    const now = new Date()
    task.deletedAt = now
    await task.save()

    await Activity.create({
      task: task._id,
      user: user.id,
      action: 'deleted',
      at: now,
    })

    // Cascade soft delete to subtasks if this is a parent task
    if (task.taskLevel === 'parent') {
      await Task.updateMany(
        { parentTask: task._id, deletedAt: null },
        { $set: { deletedAt: now } },
      )
    }

    // If deleting a subtask, resync parent status
    if (task.parentTask) {
      const pId = getParentTaskId(task.parentTask)
      if (pId) {
        await syncParentStatusFromSubtasks(pId)
      }
    }

    return {
      success: true,
      message: 'Task soft-deleted successfully',
    }
  },
}
