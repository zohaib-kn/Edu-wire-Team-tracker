import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError.js'

/**
 * Middleware ensuring that users who must change their password
 * cannot access ordinary business APIs until their password has been changed.
 */
export function requirePasswordChangeCompleted(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user && req.user.mustChangePassword) {
    return next(
      AppError.forbidden(
        'You must change your initial temporary password before accessing operational features.',
        'PASSWORD_CHANGE_REQUIRED',
      ),
    )
  }

  next()
}

