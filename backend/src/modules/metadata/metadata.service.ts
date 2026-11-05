import mongoose from 'mongoose'
import { Branch, type IBranch } from '../../models/Branch.js'
import { Team, type ITeam } from '../../models/Team.js'
import { User } from '../../models/User.js'
import { AppError } from '../../utils/AppError.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'

export interface MetadataBranchOption {
  id: string
  name: string
  city: string
  isActive: boolean
  status: 'active' | 'inactive'
}

export interface MetadataTeamOption {
  id: string
  name: string
  branch: string
  branchId: string
  isActive: boolean
  status: 'active' | 'inactive'
}

export interface MetadataTeamMemberOption {
  id: string
  name: string
  email: string
  teamId: string
}

export const metadataService = {
  /**
   * Retrieves branches accessible to the authenticated user.
   */
  async getBranches(user: AuthenticatedUserContext): Promise<MetadataBranchOption[]> {
    const filter: Record<string, any> = { isActive: true }

    // If user is restricted to a branch (not Super Admin and has branchId)
    if (user.role !== 'Super Admin' && user.branchId) {
      filter._id = user.branchId
    }

    const branches = await Branch.find(filter).sort({ name: 1 }).exec()

    return branches.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      city: b.city,
      isActive: b.isActive,
      status: b.isActive ? 'active' : 'inactive',
    }))
  },

  /**
   * Retrieves teams accessible to the authenticated user, optionally filtered by branch.
   */
  async getTeams(
    user: AuthenticatedUserContext,
    branchFilter?: string,
  ): Promise<MetadataTeamOption[]> {
    const filter: Record<string, any> = { isActive: true }

    // User branch restriction
    if (user.role !== 'Super Admin' && user.branchId) {
      filter.branch = user.branchId
    } else if (branchFilter && branchFilter !== 'all') {
      if (mongoose.Types.ObjectId.isValid(branchFilter)) {
        filter.branch = branchFilter
      } else {
        const branchDoc = await Branch.findOne({ name: branchFilter }).exec()
        if (branchDoc) {
          filter.branch = branchDoc._id
        }
      }
    }

    const teams = await Team.find(filter)
      .populate<{ branch: IBranch }>('branch')
      .sort({ name: 1 })
      .exec()

    return teams.map((t) => {
      const branchDoc = t.branch as unknown as IBranch
      const branchName = branchDoc && typeof branchDoc === 'object' && 'name' in branchDoc
        ? branchDoc.name
        : ''
      const branchId = branchDoc && typeof branchDoc === 'object' && '_id' in branchDoc
        ? branchDoc._id.toString()
        : (t.branch ? t.branch.toString() : '')

      return {
        id: t._id.toString(),
        name: t.name,
        branch: branchName,
        branchId,
        isActive: t.isActive,
        status: t.isActive ? 'active' : 'inactive',
      }
    })
  },

  /**
   * Retrieves active members belonging to a specified team for task assignment.
   */
  async getTeamMembers(
    teamId: string,
    user: AuthenticatedUserContext,
  ): Promise<MetadataTeamMemberOption[]> {
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      throw AppError.badRequest('Invalid team ID', 'INVALID_TEAM_ID')
    }

    const team = await Team.findById(teamId).exec()
    if (!team) {
      throw AppError.notFound('Team not found', 'TEAM_NOT_FOUND')
    }

    // Branch scoping: if user is not Super Admin, ensure team belongs to their branch
    if (user.role !== 'Super Admin' && user.branchId && team.branch.toString() !== user.branchId) {
      throw AppError.forbidden('You do not have access to this team', 'FORBIDDEN')
    }

    const members = await User.find({
      teams: new mongoose.Types.ObjectId(teamId),
      isActive: true,
    })
      .select('name email')
      .sort({ name: 1 })
      .exec()

    return members.map((m) => ({
      id: m._id.toString(),
      name: m.name,
      email: m.email,
      teamId,
    }))
  },
}
