import { Router } from 'express'
import { teamController } from './team.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'
import { requirePermission } from '../../middleware/requirePermission.js'

export const teamRouter = Router()

teamRouter.use(authenticate)
teamRouter.use(requirePasswordChangeCompleted)

// Read-only team options for task filters and organizational view
teamRouter.get('/', teamController.getTeams)

// Read-only team members for task assignment
teamRouter.get('/:id/members', teamController.getTeamMembers)

// Management operations restricted to team.manage
teamRouter.post('/', requirePermission('team.manage'), teamController.createTeam)
teamRouter.patch('/:id', requirePermission('team.manage'), teamController.updateTeam)

