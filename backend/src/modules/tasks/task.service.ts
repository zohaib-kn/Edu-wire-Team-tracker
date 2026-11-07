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
  CreateTaskInput,
  TaskQueryInput,
  UpdateTaskInput,
} from './task.schemas.js'

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

function formatTask(task: ITask, activities?: IActivity[]): FormattedTask {
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
   */
  async createTask(
    input: CreateTaskInput,
    user: AuthenticatedUserContext,
  ): Promise<FormattedTask> {
    // 1. Resolve Team
    let teamDoc: (ITeam & { _id: mongoose.Types.ObjectId }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.team)) {
      teamDoc = (await Team.findById(input.team).exec()) as any
    }
    if (!teamDoc) {
      teamDoc = (await Team.findOne({ name: input.team }).exec()) as any
    }
    if (!teamDoc || !teamDoc.isActive) {
      throw AppError.badRequest('Selected team does not exist or is inactive', 'TEAM_NOT_FOUND')
    }

    // 2. Resolve Owner
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

    // 3. Verify Owner belongs to Team
    const belongsToTeam =
      ownerDoc.teams &&
      ownerDoc.teams.some((t) => t.toString() === teamDoc!._id.toString())

    if (!belongsToTeam && user.role !== 'Super Admin') {
      // If user is not yet associated with team, ensure owner belongs to selected team
      throw AppError.badRequest(
        `Selected owner '${ownerDoc.name}' does not belong to team '${teamDoc.name}'`,
        'INVALID_TEAM_ASSIGNMENT',
      )
    }

    // 4. Verify user has task.create authorization for this scope
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

    // 5. Resolve Team Lead / Default Reporting Manager for teamDoc
    let defaultTeamLead: (IUser & { _id: mongoose.Types.ObjectId; role: any }) | null = null
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

    // 6. Resolve final Reporting Manager
    let finalReportingManagerId: mongoose.Types.ObjectId | null = null

    if (input.reportingManager && input.reportingManager.trim()) {
      const requested = input.reportingManager.trim()
      let candidateManager: (IUser & { _id: mongoose.Types.ObjectId; role: any }) | null = null
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

      // Self-reporting check
      if (candidateManager._id.toString() === ownerDoc._id.toString()) {
        throw AppError.badRequest('An employee cannot be assigned as their own reporting manager', 'SELF_REPORTING_NOT_ALLOWED')
      }

      // Supervisory eligibility check
      const candidateRole = candidateManager.role as unknown as IRole
      const roleName = candidateRole && typeof candidateRole === 'object' && 'name' in candidateRole ? candidateRole.name : ''
      if (!['Team Lead', 'Branch Admin', 'Super Admin'].includes(roleName)) {
        throw AppError.badRequest('Selected reporting manager does not have supervisory eligibility', 'INVALID_SUPERVISOR')
      }

      finalReportingManagerId = candidateManager._id
    } else {
      // Default: use team lead
      if (defaultTeamLead && defaultTeamLead.isActive) {
        if (defaultTeamLead._id.toString() === ownerDoc._id.toString()) {
          throw AppError.badRequest(
            'The team lead is the owner of this task. Please select another eligible reporting manager.',
            'SELF_REPORTING_NOT_ALLOWED',
          )
        }
        finalReportingManagerId = defaultTeamLead._id
      } else {
        throw AppError.badRequest(
          'Selected team does not have an active Team Lead. Please select an eligible reporting manager.',
          'REPORTING_MANAGER_REQUIRED',
        )
      }
    }

    // 7. Create task in MongoDB
    const newTask = await Task.create({
      title: input.title,
      note: input.note || '',
      team: teamDoc._id,
      branch: teamDoc.branch, // Derived from team, never trusted from client
      owner: ownerDoc._id,
      reportingManager: finalReportingManagerId,
      createdBy: user.id, // Derived from authenticated user
      due: input.due,
      priority: input.priority || 'normal',
      status: 'todo',
    })

    // 8. Record Activity
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

    // 9. Populate and return
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
        .exec(),
      Task.countDocuments(filter).exec(),
    ])

    return {
      tasks: tasks.map((t) => formatTask(t)),
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
      .exec()

    if (!task) {
      throw AppError.notFound('Task not found or has been deleted', 'TASK_NOT_FOUND')
    }

    const isReportingManager =
      task.reportingManager &&
      (task.reportingManager as any)._id
        ? (task.reportingManager as any)._id.toString() === user.id
        : task.reportingManager?.toString() === user.id

    const canView =
      isReportingManager ||
      permissionsService.can(user, 'task.view', {
        teamId: task.team,
        branchId: task.branch,
        ownerId: task.owner,
        createdById: task.createdBy,
        reportingManagerId: task.reportingManager,
      })

    if (!canView) {
      throw AppError.forbidden('You do not have permission to view this task', 'FORBIDDEN')
    }

    const activities = await Activity.find({ task: task._id })
      .sort({ at: -1 })
      .populate('user')
      .exec()

    return formatTask(task, activities)
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
      }
    }

    const populated = await Task.findById(task._id)
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .exec()

    const activities = await Activity.find({ task: task._id })
      .sort({ at: -1 })
      .populate('user')
      .exec()

    return formatTask(populated!, activities)
  },

  /**
   * Updates task status (todo, doing, done) directly without approval.
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

    const populated = await Task.findById(task._id)
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('reportingManager')
      .populate('createdBy')
      .exec()

    const activities = await Activity.find({ task: task._id })
      .sort({ at: -1 })
      .populate('user')
      .exec()

    return formatTask(populated!, activities)
  },

  /**
   * Soft deletes a task by setting deletedAt timestamp.
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

    task.deletedAt = new Date()
    await task.save()

    await Activity.create({
      task: task._id,
      user: user.id,
      action: 'deleted',
      at: new Date(),
    })

    return {
      success: true,
      message: 'Task soft-deleted successfully',
    }
  },
}
