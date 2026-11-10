import mongoose from 'mongoose'
import { Task } from '../../models/Task.js'
import { Branch } from '../../models/Branch.js'
import { Team } from '../../models/Team.js'
import { permissionsService } from '../../services/permissions.service.js'
import { AppError } from '../../utils/AppError.js'
import { getTodayDateIST, getSevenDaysAgoIST } from '../../utils/dateUtils.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'

export interface SummaryQueryFilters {
  branch?: string
  team?: string
}

export interface SummaryResult {
  late: number
  today: number
  pending: number
  done7Days: number
  total: number
}

export const summaryService = {
  /**
   * Computes scoped dashboard metrics for late, today, pending, and 7-day done tasks in Asia/Kolkata IST.
   */
  async getSummary(
    filters: SummaryQueryFilters,
    user: AuthenticatedUserContext,
  ): Promise<SummaryResult> {
    const scopeFilter = permissionsService.getScopeFilter(user, 'task.view')
    if (scopeFilter === null) {
      throw AppError.forbidden('Insufficient permissions to view summary', 'FORBIDDEN')
    }

    const baseFilter: Record<string, any> = {
      deletedAt: null,
      taskLevel: { $ne: 'parent' },
      ...scopeFilter,
    }

    // Branch filter
    if (filters.branch && filters.branch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.branch)) {
        baseFilter.branch = filters.branch
      } else {
        const branchDoc = await Branch.findOne({ name: filters.branch }).exec()
        if (branchDoc) {
          baseFilter.branch = branchDoc._id
        }
      }
    }

    // Team filter
    if (filters.team && filters.team !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.team)) {
        baseFilter.team = filters.team
      } else {
        const teamDoc = await Team.findOne({ name: filters.team }).exec()
        if (teamDoc) {
          baseFilter.team = teamDoc._id
        }
      }
    }

    const todayIST = getTodayDateIST()
    const sevenDaysAgo = getSevenDaysAgoIST()
    const now = new Date()

    const [late, today, pending, done7Days, total] = await Promise.all([
      Task.countDocuments({
        ...baseFilter,
        status: { $ne: 'done' },
        $or: [
          { deadlineAt: { $ne: null, $lt: now } },
          { deadlineAt: null, due: { $lt: todayIST } },
        ],
      }).exec(),
      Task.countDocuments({
        ...baseFilter,
        status: { $ne: 'done' },
        due: todayIST,
        $or: [
          { deadlineAt: null },
          { deadlineAt: { $gte: now } },
        ],
      }).exec(),
      Task.countDocuments({
        ...baseFilter,
        status: { $ne: 'done' },
      }).exec(),
      Task.countDocuments({
        ...baseFilter,
        status: 'done',
        $or: [
          { doneAt: { $gte: sevenDaysAgo } },
          { doneAt: null, updatedAt: { $gte: sevenDaysAgo } },
        ],
      }).exec(),
      Task.countDocuments(baseFilter).exec(),
    ])

    return {
      late,
      today,
      pending,
      done7Days,
      total,
    }
  },
}
