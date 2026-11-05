import express, { type Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { apiRouter } from './routes/index.js'
import { notFoundHandler } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

export const app: Application = express()

// Security headers
app.use(helmet())

// Restricted CORS for configured frontend origin with credentials enabled
app.use(
  cors({
    origin: env.FRONTEND_URL,
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

