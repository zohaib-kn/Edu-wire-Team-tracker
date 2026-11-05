import mongoose from 'mongoose'
import { env } from './env.js'

/**
 * Strips username and password from a MongoDB connection string
 * so it is safe to print in server logs without exposing credentials.
 */
export function sanitizeMongoUri(uri: string): string {
  try {
    // Matches mongodb://user:pass@host or mongodb+srv://user:pass@host
    return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@]+):([^@]+)@/i, '$1***:***@')
  } catch {
    return 'mongodb://***:***@hidden'
  }
}

/**
 * Returns true only when Mongoose connection state is 'connected' (readyState 1).
 * readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1
}

/**
 * Connects to MongoDB Atlas using Mongoose.
 * Avoids duplicate connections if already connected.
 */
export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    console.log('[DATABASE] MongoDB is already connected.')
    return
  }

  const sanitized = sanitizeMongoUri(env.MONGODB_URI)
  console.log(`[DATABASE] Connecting to MongoDB: ${sanitized}...`)

  try {
    // Configure connection with reasonable server selection timeout
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })

    console.log('[DATABASE] ✅ MongoDB connected successfully.')

    // Listen to connection lifecycle events
    mongoose.connection.on('error', (err) => {
      console.error('[DATABASE] ❌ MongoDB runtime connection error:', err.message)
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('[DATABASE] ⚠️  MongoDB connection lost / disconnected.')
    })

    mongoose.connection.on('reconnected', () => {
      console.log('[DATABASE] 🔄 MongoDB connection restored.')
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database connection error'
    console.error(`[DATABASE] ❌ Initial MongoDB connection failed: ${message}`)
    throw error
  }
}

/**
 * Gracefully disconnects from MongoDB during process shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect()
      console.log('[DATABASE] MongoDB connection closed gracefully.')
    } catch (err) {
      console.error('[DATABASE] Error closing MongoDB connection:', err)
    }
  }
}

