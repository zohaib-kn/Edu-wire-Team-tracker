import { Router } from 'express'
import { authController } from './auth.controller.js'
import { authenticate } from '../../middleware/authenticate.js'
import { loginRateLimiter } from '../../middleware/rateLimiter.js'

export const authRouter = Router()

// Public authentication endpoints
authRouter.post('/login', loginRateLimiter(), authController.login)
authRouter.post('/refresh', authController.refresh)

// Protected authentication endpoints
authRouter.get('/me', authenticate, authController.getMe)
authRouter.post('/logout', authenticate, authController.logout)
authRouter.post('/change-password', authenticate, authController.changePassword)

