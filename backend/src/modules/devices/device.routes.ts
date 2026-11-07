import { Router } from 'express'
import { deviceController } from './device.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requirePasswordChangeCompleted } from '../../middleware/requirePasswordChangeCompleted.js'

export const deviceRouter = Router()

// All device routes require authentication
deviceRouter.use(authenticate)
deviceRouter.use(requirePasswordChangeCompleted)

deviceRouter.post('/', deviceController.registerDevice)
deviceRouter.delete('/', deviceController.unregisterDevice)

