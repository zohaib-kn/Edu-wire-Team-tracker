import mongoose from 'mongoose'
import { Team, type ITeam } from '../../models/Team.js'
import { Branch, type IBranch } from '../../models/Branch.js'
import { User, type IUser } from '../../models/User.js'
import { Activity } from '../../models/Activity.js'
import { AppError } from '../../utils/AppError.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'
import type { CreateTeamInput, UpdateTeamInput } from './team.schemas.js'

export interface FormattedTeamItem {
  id: string
  name: string
  branch: string
  branchId: string
  lead?: string
  leadId?: string
  leadName?: string
  isActive: boolean
  status: 'active' | 'inactive'
  memberCount: number
  createdAt?: string
  updatedAt?: string
}

export interface FormattedTeamMember {
  id: string
  name: string
  email: string
  teamId: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatTeam(team: ITeam, memberCount = 0): FormattedTeamItem {
  const branchDoc = team.branch as unknown as IBranch
  const leadDoc = team.lead as unknown as IUser

  const branchName = branchDoc && typeof branchDoc === 'object' && 'name' in branchDoc
    ? branchDoc.name
    : ''
  const branchId = branchDoc && typeof branchDoc === 'object' && '_id' in branchDoc
    ? branchDoc._id.toString()
    : (team.branch ? team.branch.toString() : '')

  const leadName = leadDoc && typeof leadDoc === 'object' && 'name' in leadDoc
    ? leadDoc.name
    : ''
  const leadId = leadDoc && typeof leadDoc === 'object' && '_id' in leadDoc
    ? leadDoc._id.toString()
    : (team.lead ? team.lead.toString() : undefined)

  return {
    id: team._id.toString(),
    name: team.name,
    branch: branchName,
    branchId,
    lead: leadName || undefined,
    leadId,
    leadName: leadName || undefined,
    isActive: team.isActive,
    status: team.isActive ? 'active' : 'inactive',
    memberCount,
    createdAt: team.createdAt ? team.createdAt.toISOString() : undefined,
    updatedAt: team.updatedAt ? team.updatedAt.toISOString() : undefined,
  }
}

export const teamService = {
  /**
   * Retrieves teams accessible to the current user, optionally filtered by branch.
   */
  async getTeams(
    currentUser: AuthenticatedUserContext,
    branchFilter?: string,
  ): Promise<FormattedTeamItem[]> {
    const filter: Record<string, any> = {}

    // Organizational scope: Branch Admin restricted to own branch
    if (currentUser.role !== 'Super Admin' && currentUser.branchId) {
      filter.branch = currentUser.branchId
    } else if (branchFilter && branchFilter !== 'all') {
      if (mongoose.Types.ObjectId.isValid(branchFilter)) {
        filter.branch = branchFilter
      } else {
        const b = await Branch.findOne({ name: branchFilter }).exec()
        if (b) filter.branch = b._id
      }
    }

    const teams = await Team.find(filter)
      .populate('branch')
      .populate('lead')
      .sort({ name: 1 })
      .exec()

    const formattedTeams: FormattedTeamItem[] = await Promise.all(
      teams.map(async (t) => {
        const memberCount = await User.countDocuments({ teams: t._id, isActive: true }).exec()
        return formatTeam(t, memberCount)
      }),
    )

    return formattedTeams
  },

  /**
   * Retrieves eligible active members of a team for task assignment.
   */
  async getTeamMembers(
    teamId: string,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedTeamMember[]> {
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      throw AppError.badRequest('Invalid team ID', 'INVALID_TEAM_ID')
    }

    const team = await Team.findById(teamId).exec()
    if (!team) {
      throw AppError.notFound('Team not found', 'TEAM_NOT_FOUND')
    }

    // Branch Admin boundary check
    if (currentUser.role !== 'Super Admin' && currentUser.branchId && team.branch.toString() !== currentUser.branchId) {
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

  /**
   * Creates a team within a branch (requires team.manage).
   */
  async createTeam(
    input: CreateTeamInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedTeamItem> {
    // 1. Resolve Branch
    let branchDoc: (IBranch & { _id: mongoose.Types.ObjectId }) | null = null
    if (mongoose.Types.ObjectId.isValid(input.branch)) {
      branchDoc = (await Branch.findById(input.branch).exec()) as any
    }
    if (!branchDoc) {
      branchDoc = (await Branch.findOne({ name: input.branch }).exec()) as any
    }
    if (!branchDoc || !branchDoc.isActive) {
      throw AppError.badRequest('Selected branch does not exist or is inactive', 'BRANCH_NOT_FOUND')
    }

    // Branch Admin boundary
    if (currentUser.role !== 'Super Admin') {
      if (!currentUser.branchId || currentUser.branchId !== branchDoc._id.toString()) {
        throw AppError.forbidden(
          'Branch Admins can only create teams within their assigned branch',
          'INSUFFICIENT_SCOPE',
        )
      }
    }

    // 2. Check team name uniqueness within branch
    const existing = await Team.findOne({
      branch: branchDoc._id,
      name: { $regex: new RegExp(`^${escapeRegex(input.name)}$`, 'i') },
    }).exec()

    if (existing) {
      throw AppError.conflict(
        `A team named '${input.name}' already exists in branch '${branchDoc.name}'`,
        'TEAM_ALREADY_EXISTS',
      )
    }

    // 3. Resolve Team Lead if provided
    let leadDoc: (IUser & { _id: mongoose.Types.ObjectId }) | null = null
    if (input.lead && input.lead.trim()) {
      if (mongoose.Types.ObjectId.isValid(input.lead)) {
        leadDoc = (await User.findById(input.lead).exec()) as any
      }
      if (!leadDoc) {
        leadDoc = (await User.findOne({
          $or: [{ email: input.lead.toLowerCase() }, { name: input.lead }],
        }).exec()) as any
      }

      if (!leadDoc || !leadDoc.isActive) {
        throw AppError.badRequest('Selected team lead is not found or is inactive', 'INVALID_LEAD')
      }

      if (leadDoc.branch && leadDoc.branch.toString() !== branchDoc._id.toString()) {
        throw AppError.badRequest(
          `Team lead '${leadDoc.name}' belongs to a different branch`,
          'LEAD_BRANCH_MISMATCH',
        )
      }
    }

    // 4. Create Team
    const newTeam = await Team.create({
      name: input.name,
      branch: branchDoc._id,
      lead: (leadDoc ? (leadDoc as any)._id : undefined) as any,
      isActive: input.isActive !== undefined ? input.isActive : true,
    })

    // 5. If lead was assigned, ensure team is added to lead's teams array
    if (leadDoc) {
      await User.findByIdAndUpdate((leadDoc as any)._id, {
        $addToSet: { teams: newTeam._id },
      }).exec()
    }

    // 6. Audit activity
    await Activity.create({
      user: currentUser.id,
      action: 'team_created',
      to: { teamId: newTeam._id, name: newTeam.name, branch: branchDoc.name },
      at: new Date(),
    })

    const populated = await Team.findById(newTeam._id)
      .populate('branch')
      .populate('lead')
      .exec()

    return formatTeam(populated!, leadDoc ? 1 : 0)
  },

  /**
   * Updates an existing team (requires team.manage).
   */
  async updateTeam(
    id: string,
    input: UpdateTeamInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedTeamItem> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid team ID', 'TEAM_NOT_FOUND')
    }

    const team = await Team.findById(id).populate<{ branch: IBranch }>('branch').exec()
    if (!team) {
      throw AppError.notFound('Team not found', 'TEAM_NOT_FOUND')
    }

    // Branch Admin boundary
    if (currentUser.role !== 'Super Admin') {
      const teamBranchId = team.branch ? (team.branch._id ? team.branch._id.toString() : team.branch.toString()) : ''
      if (!currentUser.branchId || currentUser.branchId !== teamBranchId) {
        throw AppError.forbidden('Cannot manage teams outside your branch', 'FORBIDDEN')
      }
    }

    // Branch change
    let targetBranchId = team.branch ? (team.branch._id ? team.branch._id : team.branch) : null
    if (input.branch !== undefined) {
      let branchDoc: (IBranch & { _id: mongoose.Types.ObjectId }) | null = null
      if (mongoose.Types.ObjectId.isValid(input.branch)) {
        branchDoc = (await Branch.findById(input.branch).exec()) as any
      }
      if (!branchDoc) {
        branchDoc = (await Branch.findOne({ name: input.branch }).exec()) as any
      }
      if (!branchDoc || !branchDoc.isActive) {
        throw AppError.badRequest('Selected branch does not exist or is inactive', 'BRANCH_NOT_FOUND')
      }

      if (currentUser.role !== 'Super Admin' && currentUser.branchId !== branchDoc._id.toString()) {
        throw AppError.forbidden('Branch Admins cannot move teams to other branches', 'INSUFFICIENT_SCOPE')
      }

      team.branch = branchDoc._id as any
      targetBranchId = branchDoc._id
    }

    // Name change
    const newName = input.name !== undefined ? input.name : team.name
    if (input.name !== undefined || input.branch !== undefined) {
      const existing = await Team.findOne({
        _id: { $ne: team._id },
        branch: targetBranchId,
        name: { $regex: new RegExp(`^${escapeRegex(newName)}$`, 'i') },
      } as any).exec()

      if (existing) {
        throw AppError.conflict(
          `A team named '${newName}' already exists in this branch`,
          'TEAM_ALREADY_EXISTS',
        )
      }
      team.name = newName
    }

    // Lead change
    if (input.lead !== undefined) {
      if (!input.lead || input.lead.trim() === '') {
        team.lead = undefined
      } else {
        let leadDoc: (IUser & { _id: mongoose.Types.ObjectId }) | null = null
        if (mongoose.Types.ObjectId.isValid(input.lead)) {
          leadDoc = (await User.findById(input.lead).exec()) as any
        }
        if (!leadDoc) {
          leadDoc = (await User.findOne({
            $or: [{ email: input.lead.toLowerCase() }, { name: input.lead }],
          }).exec()) as any
        }

        if (!leadDoc || !leadDoc.isActive) {
          throw AppError.badRequest('Selected team lead is not found or is inactive', 'INVALID_LEAD')
        }

        if (targetBranchId && leadDoc.branch && leadDoc.branch.toString() !== targetBranchId.toString()) {
          throw AppError.badRequest(
            `Team lead '${leadDoc.name}' belongs to a different branch`,
            'LEAD_BRANCH_MISMATCH',
          )
        }

        team.lead = (leadDoc as any)._id
        // Add team to new lead's teams array
        await User.findByIdAndUpdate((leadDoc as any)._id, {
          $addToSet: { teams: team._id },
        }).exec()
      }
    }

    if (input.isActive !== undefined) {
      team.isActive = input.isActive
    }

    await team.save()

    await Activity.create({
      user: currentUser.id,
      action: 'team_updated',
      to: { teamId: team._id, name: team.name },
      at: new Date(),
    })

    const memberCount = await User.countDocuments({ teams: team._id, isActive: true }).exec()
    const populated = await Team.findById(team._id)
      .populate('branch')
      .populate('lead')
      .exec()

    return formatTeam(populated!, memberCount)
  },
}
