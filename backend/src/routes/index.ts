import { Router } from 'express'
import { healthRouter } from './health.routes.js'
import { authRouter } from '../modules/auth/auth.routes.js'
import { taskRouter } from '../modules/tasks/task.routes.js'
import { summaryRouter } from '../modules/summary/summary.routes.js'
import { userRouter } from '../modules/users/user.routes.js'
import { branchRouter } from '../modules/branches/branch.routes.js'
import { teamRouter } from '../modules/teams/team.routes.js'
import { roleRouter } from '../modules/roles/role.routes.js'
import { reportRouter } from '../modules/reports/report.routes.js'

export const apiRouter = Router()

// Health check endpoint: GET /api/v1/health
apiRouter.use(healthRouter)

// Authentication endpoints: /api/v1/auth/*
apiRouter.use('/auth', authRouter)

// Task management endpoints: /api/v1/tasks/*
apiRouter.use('/tasks', taskRouter)

// Dashboard summary metrics: /api/v1/summary
apiRouter.use('/summary', summaryRouter)

// User administration endpoints: /api/v1/users/*
apiRouter.use('/users', userRouter)

// Branch management endpoints: /api/v1/branches/*
apiRouter.use('/branches', branchRouter)

// Team management endpoints: /api/v1/teams/*
apiRouter.use('/teams', teamRouter)

// Roles & permissions endpoints: /api/v1/roles/*
apiRouter.use('/roles', roleRouter)

// Reports & analytics endpoints: /api/v1/reports/*
apiRouter.use('/reports', reportRouter)
