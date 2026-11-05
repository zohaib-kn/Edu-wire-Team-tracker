import { Router } from 'express'
import { healthRouter } from './health.routes.js'

export const apiRouter = Router()

// Health check endpoint: GET /api/v1/health
apiRouter.use(healthRouter)

/*
 * Future API Modules (Phase 2 & beyond):
 * - /api/v1/auth     -> authRouter
 * - /api/v1/tasks    -> tasksRouter
 * - /api/v1/users    -> usersRouter
 * - /api/v1/teams    -> teamsRouter
 * - /api/v1/branches -> branchesRouter
 * - /api/v1/roles    -> rolesRouter
 * - /api/v1/reports  -> reportsRouter
 * - /api/v1/summary  -> summaryRouter
 *
 * (Note: Per Phase 1 rules, no dummy data or fabricated 200 OK handlers are mounted here)
 */

