export interface BranchItem {
  id: string
  name: string
  city: string
  isActive?: boolean
  status?: 'active' | 'inactive' | string
  teamCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface TeamItem {
  id: string
  name: string
  branch: string
  branchId?: string
  lead?: string
  leadId?: string
  leadName?: string
  isActive?: boolean
  status?: 'active' | 'inactive' | string
  memberCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateBranchPayload {
  name: string
  city: string
  isActive?: boolean
}

export interface UpdateBranchPayload {
  name?: string
  city?: string
  isActive?: boolean
}

export interface CreateTeamPayload {
  name: string
  branch: string
  lead?: string
  isActive?: boolean
}

export interface UpdateTeamPayload {
  name?: string
  branch?: string
  lead?: string
  isActive?: boolean
}

