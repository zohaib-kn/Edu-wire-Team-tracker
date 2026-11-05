import {
  useState,
  type ReactNode,
} from 'react'
import type {
  LoginCredentials,
  User,
} from '@/features/auth/types/auth.types'
import { AuthContext, type AuthContextValue } from './AuthContext'

// Demo user enabled for frontend design review (no backend required)
const DEMO_USER: User = {
  id: 'usr_demo_01',
  email: 'zohaib.works022@gmail.com',
  name: 'Zohaib Khan',
  role: 'Super Admin',
  mustChangePassword: false, // Set to true to preview the mandatory Change Password screen
  status: 'active',
  permissions: [
    'task.view',
    'task.create',
    'task.edit',
    'task.status',
    'task.delete',
    'report.view',
    'user.manage',
    'team.manage',
    'branch.manage',
    'role.manage',
  ],
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialized directly with the demo user so you can immediately see the design
  const [user, setUser] = useState<User | null>(DEMO_USER)
  const [isLoading] = useState<boolean>(false)

  const login = async (credentials: LoginCredentials): Promise<User> => {
    const loggedInUser: User = {
      ...DEMO_USER,
      email: credentials.email || DEMO_USER.email,
    }
    setUser(loggedInUser)
    return loggedInUser
  }

  const logout = async (): Promise<void> => {
    setUser(null)
  }

  const changePassword = async (): Promise<void> => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null))
  }

  const fetchCurrentUser = async (): Promise<User | null> => {
    return user
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    changePassword,
    refreshUser: fetchCurrentUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
