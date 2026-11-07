import type { Server } from 'node:http'
import './models/index.js'
import { app } from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { closeRedisConnections, checkRedisConnection, getSharedRedisConnection } from './config/redis.js'
import { closeAllQueues } from './queues/queue.manager.js'
import { initWorkersInProcess, stopWorkers } from './workers/index.js'

let server: Server | null = null

async function startServer(): Promise<void> {
  console.log('----------------------------------------------------')
  console.log(`Starting Edu Wire Team Tracker Backend...`)
  console.log(`Environment: ${env.NODE_ENV}`)
  console.log(`Frontend URL: ${env.FRONTEND_URL}`)
  console.log(`Port: ${env.PORT}`)
  console.log('----------------------------------------------------')

  // Start HTTP server listener
  server = app.listen(env.PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${env.PORT}`)
    console.log(`📡 Health Check: http://localhost:${env.PORT}/api/v1/health`)
  })

  // Attempt MongoDB connection
  try {
    await connectDatabase()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[DATABASE] Initial connection could not be established: ${errorMsg}`)

    if (env.NODE_ENV === 'production') {
      console.error('[DATABASE] Fatal error in production mode: shutting down.')
      process.exit(1)
    } else {
      console.warn('[DATABASE] Development mode notice: server remains active for proxy/health verification.')
      console.warn('[DATABASE] Configure a valid MONGODB_URI in backend/.env to connect to your Atlas database.')
    }
  }

  // Attempt Redis startup check (non-fatal – a Redis failure must not crash the server)
  try {
    const redisClient = getSharedRedisConnection()
    await checkRedisConnection(redisClient)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[REDIS] ❌ Unexpected error during Redis startup check –', msg)
  }

  // Start background workers in-process (reuses the established DB connection).
  // Workers process BullMQ jobs (task assignment notifications, reminders, etc.)
  try {
    await initWorkersInProcess()
  } catch (workerErr) {
    const msg = workerErr instanceof Error ? workerErr.message : String(workerErr)
    console.error('[WORKERS] ❌ Failed to initialize in-process workers –', msg)
    console.warn('[WORKERS] ⚠️  Server continues without background workers. Notifications will not be processed.')
  }
}

// Graceful shutdown handling
async function handleShutdown(signal: string): Promise<void> {
  console.log(`\n[SERVER] ${signal} signal received. Initiating graceful shutdown...`)

  if (server) {
    server.close(() => {
      console.log('[SERVER] HTTP server closed.')
    })
  }

  // Stop workers first (skipDbClose=true so we handle DB disconnect below)
  await stopWorkers(true)
  await closeAllQueues()
  await closeRedisConnections()
  await disconnectDatabase()
  console.log('[SERVER] Graceful shutdown complete. Exiting.')
  process.exit(0)
}

process.on('SIGINT', () => void handleShutdown('SIGINT'))
process.on('SIGTERM', () => void handleShutdown('SIGTERM'))

void startServer()

