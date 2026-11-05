import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

// Layouts and Guards
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { GuestRoute } from '@/components/auth/GuestRoute'
import { RequirePasswordChange } from '@/components/auth/RequirePasswordChange'

// Pages
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MyTasksPage } from '@/pages/MyTasksPage'
import { CreateTaskPage } from '@/pages/CreateTaskPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { UsersPage } from '@/pages/UsersPage'
import { BranchesTeamsPage } from '@/pages/BranchesTeamsPage'
import { RolesPage } from '@/pages/RolesPage'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { PERMISSIONS } from '@/lib/permissions/permissions'

const router = createBrowserRouter([
  // Guest route: Login
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },

  // Forced password change route
  {
    path: '/change-password',
    element: (
      <RequirePasswordChange>
        <ChangePasswordPage />
      </RequirePasswordChange>
    ),
  },

  // Authenticated Application Shell
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'my-tasks',
        element: <MyTasksPage />,
      },
      {
        path: 'tasks/new',
        element: (
          <ProtectedRoute requiredPermission={PERMISSIONS.TASK_CREATE}>
            <CreateTaskPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tasks/:id',
        element: <TaskDetailPage />,
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermission={PERMISSIONS.REPORT_VIEW}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute requiredPermission={PERMISSIONS.USER_MANAGE}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'branches-teams',
        element: (
          <ProtectedRoute
            requiredPermission={[
              PERMISSIONS.BRANCH_MANAGE,
              PERMISSIONS.TEAM_MANAGE,
            ]}
          >
            <BranchesTeamsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'roles',
        element: (
          <ProtectedRoute requiredPermission={PERMISSIONS.ROLE_MANAGE}>
            <RolesPage />
          </ProtectedRoute>
        ),
      },
    ],
  },

  // 404 Catch-All
  {
    path: '*',
    element: <NotFoundPage />,
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
