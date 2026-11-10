import express, { type Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import './models/index.js' // Eagerly register all Mongoose models
import { env } from './config/env.js'
import { apiRouter } from './routes/index.js'
import { notFoundHandler } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

export const app: Application = express()

// Trust immediate reverse proxy hop in production (Render / Nginx / Vercel)
// so req.ip, req.protocol, and login rate limiting behave accurately
app.set(
  'trust proxy',
  env.TRUST_PROXY ?? (env.NODE_ENV === 'production' ? 1 : false),
)

// Security headers
app.use(helmet())

// Parse comma-separated FRONTEND_URL origins and normalize trailing slashes
const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

// Restricted CORS for configured frontend origin(s) with credentials enabled
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow same-server / non-browser requests without an Origin header
      if (!requestOrigin) {
        callback(null, true)
        return
      }
      const normalizedOrigin = requestOrigin.replace(/\/+$/, '')
      callback(null, allowedOrigins.includes(normalizedOrigin))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// Body parsers
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// Cookie parser for refresh token cookies
app.use(cookieParser())

// Application API routes mounted strictly under /api/v1
app.use('/api/v1', apiRouter)

// 404 handler for any unmapped routes
app.use(notFoundHandler)

// Centralized error handling middleware
app.use(errorHandler)

