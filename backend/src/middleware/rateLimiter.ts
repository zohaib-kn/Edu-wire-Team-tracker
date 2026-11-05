import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError.js'

interface RateLimitRecord {
  count: number
  resetTime: number
}

const loginAttempts = new Map<string, RateLimitRecord>()

// Periodically clean expired rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of loginAttempts.entries()) {
    if (now > record.resetTime) {
      loginAttempts.delete(key)
    }
  }
}, 5 * 60 * 1000).unref()

/**
 * In-memory rate limiting middleware for login endpoints.
 * Limits each IP address to max 15 login attempts per minute.
 */
export function loginRateLimiter(windowMs = 60 * 1000, maxRequests = 15) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client'
    const now = Date.now()

    const record = loginAttempts.get(ip)

    if (!record || now > record.resetTime) {
      loginAttempts.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      })
      return next()
    }

    record.count += 1

    if (record.count > maxRequests) {
      const waitSeconds = Math.ceil((record.resetTime - now) / 1000)
      return next(
        AppError.tooManyRequests(
          `Too many sign in attempts from this network. Please wait ${waitSeconds} second(s) before trying again.`,
          'RATE_LIMITED',
        ),
      )
    }

    next()
  }
}

