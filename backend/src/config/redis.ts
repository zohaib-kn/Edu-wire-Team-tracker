import { Redis, type RedisOptions } from 'ioredis'
import { createRequire } from 'module'
import { env } from './env.js'

const require = createRequire(import.meta.url)

// Track active connections for graceful shutdown
const activeConnections = new Set<Redis>()

let isMockMode = env.USE_MOCK_REDIS || process.env.NODE_ENV === 'test'

export function setRedisMockMode(enabled: boolean) {
  isMockMode = enabled
}

export function isRedisMockEnabled(): boolean {
  return isMockMode
}

/**
 * Strips password and sensitive tokens from Redis URLs for safe logging.
 */
export function sanitizeRedisUrl(url?: string): string {
  if (!url) return `${env.REDIS_HOST}:${env.REDIS_PORT}`
  try {
    return url.replace(/(redis(?:s)?:\/\/)([^:@]+):([^@]+)@/i, '$1***:***@')
  } catch {
    return 'redis://***:***@hidden'
  }
}

/**
 * Returns BullMQ-required options that are safe to merge regardless of
 * whether a URL or host/port is used. Does NOT include host, port, or
 * password — those must only come from the URL (when REDIS_URL is set) or
 * from the explicit host/port/password fields (when it is not).
 */
export function getBullmqOptions(): Pick<
  RedisOptions,
  'maxRetriesPerRequest' | 'enableReadyCheck' | 'retryStrategy' | 'lazyConnect'
> {
  return {
    // BullMQ hard requirements:
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      // Exponential backoff capped at 10 s
      return Math.min(times * 500, 10000)
    },
    lazyConnect: true,
  }
}

/**
 * Returns Redis options for host/port-based connections (used only when
 * REDIS_URL is NOT set). Never called when a URL is present, so these
 * fields cannot accidentally override URL-parsed credentials.
 */
export function getHostPortConfig(): RedisOptions {
  // Auto-enable TLS when connecting directly to an Upstash host without a URL
  const useTls = env.REDIS_HOST?.includes('upstash.io')
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    ...(useTls ? { tls: {} } : {}),
    ...getBullmqOptions(),
  }
}

/**
 * @deprecated Use getBullmqOptions() or getHostPortConfig() directly.
 * Kept for any external callers that referenced getRedisConfig().
 */
export function getRedisConfig(): RedisOptions {
  return env.REDIS_URL ? getBullmqOptions() : getHostPortConfig()
}

/**
 * Creates an ioredis client or mock client based on configuration.
 *
 * IMPORTANT – ioredis URL + options interaction:
 *   When new Redis(url, options) is called, any field present in `options`
 *   (host, port, password, tls …) OVERRIDES the value parsed from the URL.
 *   To prevent this we pass ONLY the BullMQ-required flags (no host/port/
 *   password) when REDIS_URL is set. All connection details come exclusively
 *   from the URL in that case.
 */
export function createRedisClient(customOptions?: Partial<RedisOptions>): Redis {
  if (isMockMode) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RedisMock = require('ioredis-mock')
      const mockClient = new RedisMock() as Redis
      activeConnections.add(mockClient)
      return mockClient
    } catch {
      // Fallback to real redis if mock not found
    }
  }

  let client: Redis
  if (env.REDIS_URL) {
    // Pass only BullMQ flags – NOT host/port/password – so the URL is not overridden.
    client = new Redis(env.REDIS_URL, {
      ...getBullmqOptions(),
      ...customOptions,
    })
  } else {
    client = new Redis({
      ...getHostPortConfig(),
      ...customOptions,
    })
  }

  client.on('error', (err: Error) => {
    // Suppress connection spam if Redis is offline during development.
    // Never print the URL or password – use the sanitized form only.
    const msg = err.message || String(err)
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      console.warn(
        `[REDIS] ⚠️  Connection warning: Could not reach Redis at ${sanitizeRedisUrl(env.REDIS_URL)} – ${msg}`,
      )
    } else {
      console.error('[REDIS] ❌ Redis error:', msg)
    }
  })

  client.on('connect', () => {
    console.log(`[REDIS] 🔌 Connecting to Redis at ${sanitizeRedisUrl(env.REDIS_URL)} …`)
  })

  client.on('ready', () => {
    console.log('[REDIS] ✅ Redis connected – connection ready for BullMQ jobs')
  })

  client.on('close', () => {
    // Normal connection closure – no action needed
  })

  activeConnections.add(client)
  return client
}

// Shared singleton connection instance for general queue operations
let sharedRedisConnection: Redis | null = null

/**
 * Performs a startup PING against the shared Redis connection and logs the
 * result. Call this once from startServer() after the shared client is created.
 * Never prints the connection URL or password on failure.
 */
export async function checkRedisConnection(client?: Redis): Promise<void> {
  const target = client || sharedRedisConnection
  if (!target) {
    console.warn('[REDIS] ⚠️  No Redis client available for startup check.')
    return
  }
  try {
    // connect() is a no-op if the client is already connected (lazyConnect mode)
    await target.connect()
    const pong = await target.ping()
    if (pong === 'PONG') {
      console.log('[REDIS] ✅ Redis connected – startup ping successful')
    } else {
      console.warn(`[REDIS] ⚠️  Redis ping returned unexpected response: ${pong}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Log a clear message WITHOUT the URL or password
    console.error('[REDIS] ❌ Redis startup check failed –', msg)
    console.error('[REDIS]    Verify that REDIS_URL is set correctly in backend/.env and that your Upstash instance is reachable.')
  }
}

export function getSharedRedisConnection(): Redis {
  if (!sharedRedisConnection || sharedRedisConnection.status === 'end') {
    sharedRedisConnection = createRedisClient()
  }
  return sharedRedisConnection
}

/**
 * Enables mock mode (used for test suites when no Redis daemon is running).
 */
export function setMockRedisMode(enabled: boolean): void {
  isMockMode = enabled
  if (sharedRedisConnection) {
    sharedRedisConnection.disconnect()
    sharedRedisConnection = null
  }
}

/**
 * Checks if Redis is currently connected and responsive.
 */
export async function isRedisConnected(client?: Redis): Promise<boolean> {
  const target = client || sharedRedisConnection
  if (!target) return false
  try {
    const pong = await target.ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}

/**
 * Gracefully disconnects all active Redis connections.
 */
export async function closeRedisConnections(): Promise<void> {
  console.log(`[REDIS] Closing ${activeConnections.size} active Redis connections...`)
  const promises: Promise<any>[] = []

  for (const client of activeConnections) {
    try {
      if (typeof client.quit === 'function') {
        promises.push(client.quit().catch(() => client.disconnect()))
      } else {
        client.disconnect()
      }
    } catch {
      // Ignore closure errors
    }
  }

  await Promise.allSettled(promises)
  activeConnections.clear()
  sharedRedisConnection = null
  console.log('[REDIS] All Redis connections closed successfully.')
}
