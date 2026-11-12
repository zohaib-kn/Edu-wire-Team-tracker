import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  matchPath,
  useLocation,
} from 'react-router-dom'

// Layouts and Guards
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { GuestRoute } from '@/components/auth/GuestRoute'
import { RequirePasswordChange } from '@/components/auth/RequirePasswordChange'

// Pages
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { MyTasksPage } from '@/pages/MyTasksPage'
import { TaskHistoryPage } from '@/pages/TaskHistoryPage'
import { CreateTaskPage } from '@/pages/CreateTaskPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { UsersPage } from '@/pages/UsersPage'
import { BranchesTeamsPage } from '@/pages/BranchesTeamsPage'
import { RolesPage } from '@/pages/RolesPage'
import { NotFoundPage } from '@/components/common/NotFoundPage'
import { PERMISSIONS } from '@/lib/permissions/permissions'
import type { TaskDetailLocationState } from '@/features/tasks/utils/taskNavigation'

function AppRoutes() {
  const location = useLocation()
  const state = location.state as TaskDetailLocationState | null

  const isTaskDetailMatch =
    location.pathname !== '/tasks/new' &&
    Boolean(matchPath('/tasks/:id', location.pathname))

  const backgroundLocation =
    isTaskDetailMatch &&
    state?.backgroundLocation &&
    !state.backgroundLocation.pathname.startsWith('/tasks/')
      ? state.backgroundLocation
      : undefined

  return (
    <>
      <Routes location={backgroundLocation || location}>
        {/* Guest route: Login */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        {/* Forced password change route */}
        <Route
          path="/change-password"
          element={
            <RequirePasswordChange>
              <ChangePasswordPage />
            </RequirePasswordChange>
          }
        />

        {/* Authenticated Application Shell */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="history" element={<TaskHistoryPage />} />
          <Route
            path="tasks/new"
            element={
              <ProtectedRoute requiredPermission={PERMISSIONS.TASK_CREATE}>
                <CreateTaskPage />
              </ProtectedRoute>
            }
          />
          <Route path="tasks/:id" element={<TaskDetailPage isModal={false} />} />
          <Route
            path="reports"
            element={
              <ProtectedRoute requiredPermission={PERMISSIONS.REPORT_VIEW}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute requiredPermission={PERMISSIONS.USER_MANAGE}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="branches-teams"
            element={
              <ProtectedRoute
                requiredPermission={[
                  PERMISSIONS.BRANCH_MANAGE,
                  PERMISSIONS.TEAM_MANAGE,
                ]}
              >
                <BranchesTeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="roles"
            element={
              <ProtectedRoute requiredPermission={PERMISSIONS.ROLE_MANAGE}>
                <RolesPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Route-aware Task Detail workspace modal rendered over the background page */}
      {backgroundLocation && (
        <Routes>
          <Route
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <TaskDetailPage isModal={true} />
              </ProtectedRoute>
            }
          />
        </Routes>
      )}
    </>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
