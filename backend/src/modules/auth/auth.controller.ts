import type { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service.js'
import { loginSchema, changePasswordSchema } from './auth.schemas.js'
import {
  tokenService,
  REFRESH_COOKIE_NAME,
} from '../../services/token.service.js'

export const authController = {
  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = loginSchema.parse(req.body)
      const userAgent = req.headers['user-agent'] || 'Web Browser'

      const result = await authService.login(validatedInput, userAgent)

      // Set secure httpOnly cookie
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.refreshToken,
        tokenService.getRefreshCookieOptions(),
      )

      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const existingToken = req.cookies?.[REFRESH_COOKIE_NAME]
      const userAgent = req.headers['user-agent'] || 'Web Browser'

      const result = await authService.refresh(existingToken, userAgent)

      // Update cookie with rotated token
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.newRefreshToken,
        tokenService.getRefreshCookieOptions(),
      )

      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
      })
    } catch (error) {
      // Clear cookie on refresh error to prevent repeated failed attempts
      res.clearCookie(
        REFRESH_COOKIE_NAME,
        tokenService.getClearRefreshCookieOptions(),
      )
      next(error)
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const user = await authService.getMe(userId)

      // Return both wrapped and root format for maximum client compatibility
      res.status(200).json({
        ...user,
        user,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      const currentToken = req.cookies?.[REFRESH_COOKIE_NAME]
      const logoutAll = req.query.all === 'true'

      if (userId) {
        await authService.logout(userId, currentToken, logoutAll)
      }

      // Clear refresh cookie
      res.clearCookie(
        REFRESH_COOKIE_NAME,
        tokenService.getClearRefreshCookieOptions(),
      )

      res.status(200).json({
        success: true,
        message: logoutAll
          ? 'Logged out of all active sessions'
          : 'Logged out successfully',
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/v1/auth/change-password
   */
  async changePassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.id
      const validatedInput = changePasswordSchema.parse(req.body)
      const userAgent = req.headers['user-agent'] || 'Web Browser'

      const result = await authService.changePassword(
        userId,
        validatedInput,
        userAgent,
      )

      // Set updated refresh cookie
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.newRefreshToken,
        tokenService.getRefreshCookieOptions(),
      )

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        accessToken: result.newAccessToken,
        user: result.user,
      })
    } catch (error) {
      next(error)
    }
  },
}

