import type { Server } from 'node:http'
import { app } from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'

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
}

// Graceful shutdown handling
async function handleShutdown(signal: string): Promise<void> {
  console.log(`\n[SERVER] ${signal} signal received. Initiating graceful shutdown...`)

  if (server) {
    server.close(() => {
      console.log('[SERVER] HTTP server closed.')
    })
  }

  await disconnectDatabase()
  console.log('[SERVER] Graceful shutdown complete. Exiting.')
  process.exit(0)
}

process.on('SIGINT', () => void handleShutdown('SIGINT'))
process.on('SIGTERM', () => void handleShutdown('SIGTERM'))

void startServer()

