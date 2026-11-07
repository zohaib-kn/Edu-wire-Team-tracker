import type { Request, Response, NextFunction } from 'express'
import { registerDeviceSchema, unregisterDeviceSchema } from './device.schemas.js'
import { expoService } from '../../services/expo.service.js'
import { User } from '../../models/User.js'
import { AppError } from '../../utils/AppError.js'

export const deviceController = {
  /**
   * Registers a new Expo push device token for the authenticated user.
   * Duplicate tokens are ignored ($addToSet), multiple devices are supported.
   */
  async registerDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const parseResult = registerDeviceSchema.safeParse(req.body)
      if (!parseResult.success) {
        const firstError = parseResult.error.issues?.[0]?.message || 'Invalid device registration data'
        throw AppError.badRequest(firstError, 'VALIDATION_ERROR')
      }

      const { token } = parseResult.data

      // Validate Expo Push Token format
      if (!expoService.isValidExpoToken(token)) {
        throw AppError.badRequest(
          'Invalid Expo push token format. Expected ExponentPushToken[...] or valid Expo token string.',
          'INVALID_DEVICE_TOKEN',
        )
      }

      // Atomically add to user pushTokens without duplicates
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { pushTokens: token } },
        { returnDocument: 'after', select: 'pushTokens' },
      ).exec()

      if (!updatedUser) {
        throw AppError.notFound('User not found', 'USER_NOT_FOUND')
      }

      res.status(200).json({
        success: true,
        message: 'Device token registered successfully',
        data: {
          registered: true,
          token,
          devicesCount: updatedUser.pushTokens.length,
        },
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Removes a push device token when logging out or retiring a device.
   */
  async unregisterDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED')
      }

      const parseResult = unregisterDeviceSchema.safeParse(req.body)
      if (!parseResult.success) {
        throw AppError.badRequest('Valid token is required', 'VALIDATION_ERROR')
      }

      const { token } = parseResult.data

      await User.findByIdAndUpdate(req.user.id, {
        $pull: { pushTokens: token },
      }).exec()

      res.status(200).json({
        success: true,
        message: 'Device token unregistered successfully',
      })
    } catch (err) {
      next(err)
    }
  },
}
