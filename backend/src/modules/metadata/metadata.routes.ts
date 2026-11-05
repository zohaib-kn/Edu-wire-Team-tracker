import { Router } from 'express'
import { metadataController } from './metadata.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'

export const branchesRouter = Router()
branchesRouter.use(authenticate)
branchesRouter.use(requirePasswordChangeCompleted)
branchesRouter.get('/', metadataController.getBranches)

export const teamsRouter = Router()
teamsRouter.use(authenticate)
teamsRouter.use(requirePasswordChangeCompleted)
teamsRouter.get('/', metadataController.getTeams)
teamsRouter.get('/:id/members', metadataController.getTeamMembers)

