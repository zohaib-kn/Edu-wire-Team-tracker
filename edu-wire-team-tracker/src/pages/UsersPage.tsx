import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useBranches } from '@/features/tasks/hooks/useMetadata'
import { UsersTable } from '@/features/users/components/UsersTable'
import { UserFormSheet } from '@/features/users/components/UserFormSheet'
import { ResetPasswordDialog } from '@/features/users/components/ResetPasswordDialog'
import { DeactivateUserDialog } from '@/features/users/components/DeactivateUserDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
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

  const rawUsers = useMemo(() => usersData?.users || [], [usersData?.users])
  const totalUsers = usersData?.total ?? rawUsers.length
  const totalPages = Math.ceil(totalUsers / limit) || 1

  const handleOpenCreate = () => {
    setUserToEdit(null)
    setIsSheetOpen(true)
  }

  const handleOpenEdit = (user: ManagedUser) => {
    setUserToEdit(user)
    setIsSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Users"
        description="Manage staff accounts, credentials, and organizational access"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              aria-label="Refresh user list"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add User
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              id="search-users"
              type="search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => updateFilter('q', e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          {/* Branch Filter */}
          {showBranchFilter && (
            <div>
              <Select
                id="filter-branch"
                value={branchFilter}
                onChange={(e) => updateFilter('branch', e.target.value)}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name || b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Role Filter */}
          <div>
            <Select
              id="filter-role"
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
              id="filter-status"
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </Select>
          </div>
        </div>

        {/* Clear filters banner */}
        {(searchQuery || branchFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters active</span>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-[#1D4ED8] hover:underline font-medium ml-2 cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Users Table / Content */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Spinner size="lg" className="text-[#1D4ED8] mb-3" />
          <p className="text-sm">Loading staff accounts...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-800">
          <p className="font-semibold mb-1">Failed to load staff accounts</p>
          <p className="text-xs text-red-600 mb-4">
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4 px-2">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} ({totalUsers} total staff members)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => updateFilter('page', String(currentPage - 1))}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateFilter('page', String(currentPage + 1))}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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

