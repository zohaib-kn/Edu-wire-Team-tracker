import mongoose from 'mongoose'
import { Task, type ITask } from '../../models/Task.js'
import { Team, type ITeam } from '../../models/Team.js'
import { Branch, type IBranch } from '../../models/Branch.js'
import { User, type IUser } from '../../models/User.js'
import { permissionsService } from '../../services/permissions.service.js'
import { AppError } from '../../utils/AppError.js'
import { getTodayDateIST, getSevenDaysAgoIST } from '../../utils/dateUtils.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'

export interface ReportFilterParams {
  branch?: string
  team?: string
}

export interface DailyReportResult {
  reportText: string
  text: string
  date: string
  branch?: string
  team?: string
}

export interface WeeklyTeamPerformance {
  team: string
  branch?: string
  completed: number
  pending: number
  total: number
  completionRate: number
}

export interface WeeklyReportResult {
  period: string
  completed: number
  pending: number
  total: number
  completionRate: number
  teams: WeeklyTeamPerformance[]
}

export const reportService = {
  /**
   * Generates formatted text for daily pending tasks within the user's authorized scope.
   */
  async getDailyReport(
    filters: ReportFilterParams,
    currentUser: AuthenticatedUserContext,
  ): Promise<DailyReportResult> {
    const scopeFilter = permissionsService.getScopeFilter(currentUser, 'report.view')
    if (scopeFilter === null) {
      throw AppError.forbidden('Insufficient permissions to view reports', 'FORBIDDEN')
    }

    const query: Record<string, any> = {
      deletedAt: null,
      status: { $ne: 'done' },
      taskLevel: { $ne: 'parent' },
      ...scopeFilter,
    }

    let branchLabel = 'All Branches'
    if (filters.branch && filters.branch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.branch)) {
        query.branch = filters.branch
        const b = await Branch.findById(filters.branch).exec()
        if (b) branchLabel = b.name
      } else {
        const b = await Branch.findOne({ name: filters.branch }).exec()
        if (b) {
          query.branch = b._id
          branchLabel = b.name
        }
      }
    } else if (currentUser.role !== 'Super Admin' && currentUser.branchId) {
      const b = await Branch.findById(currentUser.branchId).exec()
      if (b) branchLabel = b.name
    }

    let teamLabel = 'All Teams'
    if (filters.team && filters.team !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.team)) {
        query.team = filters.team
        const t = await Team.findById(filters.team).exec()
        if (t) teamLabel = t.name
      } else {
        const t = await Team.findOne({ name: filters.team }).exec()
        if (t) {
          query.team = t._id
          teamLabel = t.name
        }
      }
    }

    const todayIST = getTodayDateIST()
    const now = new Date()
    const isTaskLate = (t: ITask) => (t.deadlineAt ? t.deadlineAt.getTime() < now.getTime() : t.due < todayIST)
    const isTaskDueToday = (t: ITask) => t.due === todayIST && (!t.deadlineAt || t.deadlineAt.getTime() >= now.getTime())

    const tasks = await Task.find(query)
      .sort({ priority: -1, due: 1 })
      .populate('team')
      .populate('branch')
      .populate('owner')
      .populate('createdBy')
      .exec()

    const totalCount = tasks.length
    const highPriorityCount = tasks.filter((t) => t.priority === 'high').length
    const overdueCount = tasks.filter(isTaskLate).length
    const todayCount = tasks.filter(isTaskDueToday).length

    // Format current IST time
    const timeFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    const formattedTime = timeFormatter.format(new Date())

    let reportText = ''

    if (totalCount === 0) {
      reportText = [
        '==================================================',
        '       EDU WIRE — DAILY PENDING TASKS REPORT       ',
        '==================================================',
        `Date: ${todayIST} | Generated: ${formattedTime} IST`,
        `Scope: ${branchLabel} • ${teamLabel}`,
        '==================================================',
        '',
        '✨ No pending tasks found for the selected scope.',
        'All assigned work has been completed!',
        '',
        '==================================================',
      ].join('\n')
    } else {
      const taskLines: string[] = []

      tasks.forEach((task, index) => {
        const teamDoc = task.team as unknown as ITeam
        const ownerDoc = task.owner as unknown as IUser

        const tName = teamDoc && typeof teamDoc === 'object' && 'name' in teamDoc ? teamDoc.name : 'Unassigned'
        const oName = ownerDoc && typeof ownerDoc === 'object' && 'name' in ownerDoc ? ownerDoc.name : 'Unassigned'

        let dueStatus = 'Upcoming'
        if (isTaskLate(task)) {
          dueStatus = 'OVERDUE'
        } else if (isTaskDueToday(task)) {
          dueStatus = 'DUE TODAY'
        }

        const statusLabel = task.status === 'doing' ? 'In Progress' : 'To Do'

        taskLines.push(`${index + 1}. [${task.priority.toUpperCase()}] ${task.title}`)
        taskLines.push(`   • Team: ${tName} | Assignee: ${oName}`)
        taskLines.push(`   • Due: ${task.due} (${dueStatus}) | Status: ${statusLabel}`)
        if (task.note && task.note.trim()) {
          taskLines.push(`   • Note: ${task.note.trim()}`)
        }
        taskLines.push('')
      })

      reportText = [
        '==================================================',
        '       EDU WIRE — DAILY PENDING TASKS REPORT       ',
        '==================================================',
        `Date: ${todayIST} | Generated: ${formattedTime} IST`,
        `Scope: ${branchLabel} • ${teamLabel}`,
        '--------------------------------------------------',
        'SUMMARY METRICS:',
        `• Total Incomplete Tasks: ${totalCount}`,
        `• High Priority Tasks:   ${highPriorityCount}`,
        `• Overdue / Late Tasks:  ${overdueCount}`,
        `• Due Today:             ${todayCount}`,
        '==================================================',
        '',
        'INCOMPLETE TASKS BREAKDOWN:',
        '',
        ...taskLines,
        '==================================================',
        'End of Daily Pending Brief.',
      ].join('\n')
    }

    return {
      reportText,
      text: reportText,
      date: todayIST,
      branch: branchLabel,
      team: teamLabel,
    }
  },

  /**
   * Computes completed vs pending task statistics by branch and team over the 7-day window.
   */
  async getWeeklyReport(
    filters: ReportFilterParams,
    currentUser: AuthenticatedUserContext,
  ): Promise<WeeklyReportResult> {
    const scopeFilter = permissionsService.getScopeFilter(currentUser, 'report.view')
    if (scopeFilter === null) {
      throw AppError.forbidden('Insufficient permissions to view reports', 'FORBIDDEN')
    }

    const todayIST = getTodayDateIST()
    const sevenDaysAgo = getSevenDaysAgoIST()

    // Format readable period label
    const periodFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    const startStr = periodFormatter.format(sevenDaysAgo)
    const endStr = periodFormatter.format(new Date())
    const periodLabel = `${startStr} – ${endStr} (Last 7 Days)`

    // Team query
    const teamQuery: Record<string, any> = { isActive: true }

    if (currentUser.role !== 'Super Admin' && currentUser.branchId) {
      teamQuery.branch = currentUser.branchId
    } else if (filters.branch && filters.branch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.branch)) {
        teamQuery.branch = filters.branch
      } else {
        const b = await Branch.findOne({ name: filters.branch }).exec()
        if (b) teamQuery.branch = b._id
      }
    }

    if (filters.team && filters.team !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.team)) {
        teamQuery._id = filters.team
      } else {
        const t = await Team.findOne({ name: filters.team }).exec()
        if (t) teamQuery._id = t._id
      }
    }

    const teams = await Team.find(teamQuery).populate<{ branch: IBranch }>('branch').sort({ name: 1 }).exec()

    const teamPerformanceList: WeeklyTeamPerformance[] = await Promise.all(
      teams.map(async (teamDoc) => {
        const branchDoc = teamDoc.branch as unknown as IBranch
        const branchName = branchDoc && typeof branchDoc === 'object' && 'name' in branchDoc
          ? branchDoc.name
          : 'Headquarters'

        // Completed actionable tasks in 7-day period
        const completedCount = await Task.countDocuments({
          team: teamDoc._id,
          status: 'done',
          taskLevel: { $ne: 'parent' },
          deletedAt: null,
          $or: [
            { doneAt: { $gte: sevenDaysAgo } },
            { doneAt: null, updatedAt: { $gte: sevenDaysAgo } },
          ],
        }).exec()

        // Currently pending actionable tasks
        const pendingCount = await Task.countDocuments({
          team: teamDoc._id,
          status: { $ne: 'done' },
          taskLevel: { $ne: 'parent' },
          deletedAt: null,
        }).exec()

        const teamTotal = completedCount + pendingCount
        const completionRate = teamTotal > 0 ? Math.round((completedCount / teamTotal) * 100) : 0

        return {
          team: teamDoc.name,
          branch: branchName,
          completed: completedCount,
          pending: pendingCount,
          total: teamTotal,
          completionRate,
        }
      }),
    )

    const totalCompleted = teamPerformanceList.reduce((acc, t) => acc + t.completed, 0)
    const totalPending = teamPerformanceList.reduce((acc, t) => acc + t.pending, 0)
    const grandTotal = totalCompleted + totalPending
    const overallCompletionRate = grandTotal > 0 ? Math.round((totalCompleted / grandTotal) * 100) : 0

    return {
      period: periodLabel,
      completed: totalCompleted,
      pending: totalPending,
      total: grandTotal,
      completionRate: overallCompletionRate,
      teams: teamPerformanceList,
    }
  },
}

