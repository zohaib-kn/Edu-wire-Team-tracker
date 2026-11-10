import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  History,
  BarChart3,
  Users,
  Network,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { PermissionKey } from '@/features/auth/types/auth.types'
import { PERMISSIONS } from '@/lib/permissions/permissions'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  permission?: PermissionKey | PermissionKey[]
  exact?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAVIGATION_CONFIG: NavSection[] = [
  {
    title: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'schedule',
        label: 'Schedule',
        path: '/schedule',
        icon: Calendar,
      },
      {
        id: 'my-tasks',
        label: 'My Tasks',
        path: '/my-tasks',
        icon: CheckSquare,
      },
      {
        id: 'history',
        label: 'Task History',
        path: '/history',
        icon: History,
      },
      {
        id: 'reports',
        label: 'Reports',
        path: '/reports',
        icon: BarChart3,
        permission: PERMISSIONS.REPORT_VIEW,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        id: 'users',
        label: 'Users',
        path: '/users',
        icon: Users,
        permission: PERMISSIONS.USER_MANAGE,
      },
      {
        id: 'branches-teams',
        label: 'Branches & Teams',
        path: '/branches-teams',
        icon: Network,
        permission: [PERMISSIONS.BRANCH_MANAGE, PERMISSIONS.TEAM_MANAGE],
      },
      {
        id: 'roles',
        label: 'Roles & Permissions',
        path: '/roles',
        icon: ShieldCheck,
        permission: PERMISSIONS.ROLE_MANAGE,
      },
    ],
  },
]

