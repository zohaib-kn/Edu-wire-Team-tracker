import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, RefreshCw, Filter } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useBranches } from '@/features/tasks/hooks/useMetadata'
import { UsersTable } from '@/features/users/components/UsersTable'
import { UserFormSheet } from '@/features/users/components/UserFormSheet'
import { ResetPasswordDialog } from '@/features/users/components/ResetPasswordDialog'
import { DeactivateUserDialog } from '@/features/users/components/DeactivateUserDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Pagination } from '@/components/ui/Pagination'
import { usePageHeader } from '@/context/HeaderContext'
import type { ManagedUser } from '@/features/users/types/userAdmin.types'

export function UsersPage() {
  const { user: currentAuthUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const searchQuery = searchParams.get('q') || ''
  const branchFilter = searchParams.get('branch') || 'all'
  const roleFilter = searchParams.get('role') || 'all'
  const statusFilter = searchParams.get('status') || 'all'
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const limit = 15

  const { data: branches = [] } = useBranches()

  const {
    data: usersData,
    isLoading,
    isError,
    refetch,
  } = useUsers({
    q: searchQuery,
    branch: branchFilter,
    role: roleFilter,
    status: statusFilter,
    page: currentPage,
    limit,
  })

  // Dialog and sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<ManagedUser | null>(null)
  const [userToReset, setUserToReset] = useState<ManagedUser | null>(null)
  const [userToToggleStatus, setUserToToggleStatus] = useState<ManagedUser | null>(null)

  const isSuperAdmin = currentAuthUser?.role === 'Super Admin'
  const showBranchFilter = isSuperAdmin || branches.length > 1

  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === 'all' || !value.trim()) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      if (key !== 'page') {
        next.delete('page')
      }
      return next
    })
  }

  const handleOpenCreate = () => {
    setUserToEdit(null)
    setIsSheetOpen(true)
  }

  const handleOpenEdit = (targetUser: ManagedUser) => {
    setUserToEdit(targetUser)
    setIsSheetOpen(true)
  }

  const rawUsers = usersData?.users || []
  const totalUsers = usersData?.total ?? rawUsers.length
  const totalPages = Math.ceil(totalUsers / limit) || 1

  // Top Header synchronization
  usePageHeader({
    title: 'Users',
    subtitle: 'Manage staff accounts, credentials, and roles',
    actions: (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          aria-label="Refresh user list"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          <span className="hidden sm:inline">Add User</span>
        </Button>
      </div>
    ),
  })

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="bg-surface border border-border-subtle rounded-card p-4 shadow-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search by Name/Email */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              id="users-search"
              type="search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => updateFilter('q', e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          {/* Branch Filter */}
          {showBranchFilter && (
            <div>
              <Select
                id="users-branch"
                value={branchFilter}
                onChange={(e) => updateFilter('branch', e.target.value)}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Role Filter */}
          <div>
            <Select
              id="users-role"
              value={roleFilter}
              onChange={(e) => updateFilter('role', e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Branch Admin">Branch Admin</option>
              <option value="Team Lead">Team Lead</option>
              <option value="Member">Member</option>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Select
              id="users-status"
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="inactive">Inactive / Suspended</option>
            </Select>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(searchQuery || branchFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex items-center gap-2 pt-2 border-t border-border-subtle/50 text-xs text-text-muted">
            <Filter className="w-3.5 h-3.5" />
            <span>Active filters applied</span>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-brand-blue hover:underline font-semibold ml-2 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Users Listing Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <Spinner size="lg" className="text-brand-blue mb-3" />
          <p className="text-sm font-medium">Loading user accounts...</p>
        </div>
      ) : isError ? (
        <div className="rounded-card border border-dashed border-tint-red-border bg-tint-red-bg/50 p-8 text-center text-sm text-tint-red-text">
          <p className="font-semibold mb-1">Failed to load staff accounts</p>
          <p className="text-xs text-destructive mb-4">
            Could not communicate with the user management API endpoint.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <UsersTable
            users={rawUsers}
            onEdit={handleOpenEdit}
            onResetPassword={(u) => setUserToReset(u)}
            onToggleStatus={(u) => setUserToToggleStatus(u)}
          />

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalUsers}
            itemName="staff members"
            onPageChange={(page) => updateFilter('page', String(page))}
          />
        </div>
      )}

      {/* Create / Edit User Sheet */}
      <UserFormSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        userToEdit={userToEdit}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        isOpen={Boolean(userToReset)}
        user={userToReset}
        onClose={() => setUserToReset(null)}
      />

      {/* Deactivate User Dialog */}
      <DeactivateUserDialog
        isOpen={Boolean(userToToggleStatus)}
        user={userToToggleStatus}
        onClose={() => setUserToToggleStatus(null)}
      />
    </div>
  )
}
