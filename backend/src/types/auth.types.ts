import type { IUser } from '../models/User.js'
import type { IRolePermission } from '../models/Role.js'

export interface AuthenticatedUserContext {
  id: string
  name: string
  email: string
  role: string
  branchId: string | null
  teamId: string | null
  teams: string[]
  mustChangePassword: boolean
  status: string
  permissions: IRolePermission[]
  rawUser: IUser
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserContext
    }
  }
}

