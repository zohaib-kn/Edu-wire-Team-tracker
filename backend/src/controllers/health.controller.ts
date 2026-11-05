import type { Request, Response } from 'express'
import { isDatabaseConnected } from '../config/database.js'

/**
 * Health check handler verifying real Mongoose database connectivity.
 * GET /api/v1/health
 */
export function getHealthStatus(_req: Request, res: Response): void {
  const connected = isDatabaseConnected()

  if (connected) {
    res.status(200).json({
      status: 'ok',
      database: 'connected',
    })
    return
  }

  // Database is not connected - return 503 Service Unavailable
  res.status(503).json({
    status: 'degraded',
    database: 'disconnected',
  })
}

