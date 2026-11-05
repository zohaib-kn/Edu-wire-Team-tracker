import mongoose from 'mongoose'
import { Branch, type IBranch } from '../../models/Branch.js'
import { Team } from '../../models/Team.js'
import { Activity } from '../../models/Activity.js'
import { AppError } from '../../utils/AppError.js'
import type { AuthenticatedUserContext } from '../../types/auth.types.js'
import type { CreateBranchInput, UpdateBranchInput } from './branch.schemas.js'

export interface FormattedBranchItem {
  id: string
  name: string
  city: string
  isActive: boolean
  status: 'active' | 'inactive'
  teamCount: number
  createdAt?: string
  updatedAt?: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const branchService = {
  /**
   * Retrieves branches accessible to the user with team counts.
   */
  async getBranches(currentUser: AuthenticatedUserContext): Promise<FormattedBranchItem[]> {
    const filter: Record<string, any> = {}

    // If user is restricted to a specific branch and doesn't have branch.manage
    const hasBranchManage =
      currentUser.role === 'Super Admin' ||
      currentUser.permissions.some((p) => p.key === 'branch.manage')

    if (!hasBranchManage && currentUser.branchId) {
      filter._id = currentUser.branchId
    }

    const branches = await Branch.find(filter).sort({ name: 1 }).exec()

    const formattedBranches: FormattedBranchItem[] = await Promise.all(
      branches.map(async (b) => {
        const teamCount = await Team.countDocuments({ branch: b._id, isActive: true }).exec()
        return {
          id: b._id.toString(),
          name: b.name,
          city: b.city,
          isActive: b.isActive,
          status: b.isActive ? 'active' : 'inactive',
          teamCount,
          createdAt: b.createdAt ? b.createdAt.toISOString() : undefined,
          updatedAt: b.updatedAt ? b.updatedAt.toISOString() : undefined,
        }
      }),
    )

    return formattedBranches
  },

  /**
   * Creates a new branch (requires branch.manage).
   */
  async createBranch(
    input: CreateBranchInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedBranchItem> {
    const existing = await Branch.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(input.name)}$`, 'i') },
    }).exec()

    if (existing) {
      throw AppError.conflict(
        `A branch with name '${input.name}' already exists`,
        'BRANCH_ALREADY_EXISTS',
      )
    }

    const newBranch = await Branch.create({
      name: input.name,
      city: input.city,
      isActive: input.isActive !== undefined ? input.isActive : true,
    })

    await Activity.create({
      user: currentUser.id,
      action: 'branch_created',
      to: { branchId: newBranch._id, name: newBranch.name },
      at: new Date(),
    })

    return {
      id: newBranch._id.toString(),
      name: newBranch.name,
      city: newBranch.city,
      isActive: newBranch.isActive,
      status: newBranch.isActive ? 'active' : 'inactive',
      teamCount: 0,
      createdAt: newBranch.createdAt ? newBranch.createdAt.toISOString() : undefined,
      updatedAt: newBranch.updatedAt ? newBranch.updatedAt.toISOString() : undefined,
    }
  },

  /**
   * Updates an existing branch (requires branch.manage).
   */
  async updateBranch(
    id: string,
    input: UpdateBranchInput,
    currentUser: AuthenticatedUserContext,
  ): Promise<FormattedBranchItem> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.notFound('Invalid branch ID', 'BRANCH_NOT_FOUND')
    }

    const branch = await Branch.findById(id).exec()
    if (!branch) {
      throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND')
    }

    if (input.name !== undefined && input.name !== branch.name) {
      const existing = await Branch.findOne({
        _id: { $ne: branch._id },
        name: { $regex: new RegExp(`^${escapeRegex(input.name)}$`, 'i') },
      } as any).exec()

      if (existing) {
        throw AppError.conflict(
          `A branch with name '${input.name}' already exists`,
          'BRANCH_ALREADY_EXISTS',
        )
      }
      branch.name = input.name
    }

    if (input.city !== undefined) branch.city = input.city
    if (input.isActive !== undefined) branch.isActive = input.isActive

    await branch.save()

    await Activity.create({
      user: currentUser.id,
      action: 'branch_updated',
      to: { branchId: branch._id, name: branch.name },
      at: new Date(),
    })

    const teamCount = await Team.countDocuments({ branch: branch._id, isActive: true }).exec()

    return {
      id: branch._id.toString(),
      name: branch.name,
      city: branch.city,
      isActive: branch.isActive,
      status: branch.isActive ? 'active' : 'inactive',
      teamCount,
      createdAt: branch.createdAt ? branch.createdAt.toISOString() : undefined,
      updatedAt: branch.updatedAt ? branch.updatedAt.toISOString() : undefined,
    }
  },
}
