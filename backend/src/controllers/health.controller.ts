import type { Request, Response } from 'express'
import { isDatabaseConnected } from '../config/database.js'
import { isRedisMockEnabled, getSharedRedisConnection } from '../config/redis.js'

/**
 * Health check handler verifying real Mongoose database and Redis connectivity.
 * GET /api/v1/health
 */
export function getHealthStatus(_req: Request, res: Response): void {
  const connected = isDatabaseConnected()
  const redisMock = isRedisMockEnabled()
  let redisStatus = redisMock ? 'mock' : 'disconnected'

  try {
    const redis = getSharedRedisConnection()
    if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
      redisStatus = 'connected'
    }
  } catch {}

  if (connected) {
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Database is not connected - return 503 Service Unavailable
  res.status(503).json({
    status: 'degraded',
    database: 'disconnected',
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  })
}

