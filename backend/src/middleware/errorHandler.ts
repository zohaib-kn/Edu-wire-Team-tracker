import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/AppError.js'
import { env } from '../config/env.js'

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Operational AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    })
    return
  }

  // Zod schema validation errors
  if (err instanceof ZodError) {
    const formattedMessage = err.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: formattedMessage || 'Invalid request parameters',
      },
    })
    return
  }

  // Body parser invalid JSON syntax error
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    err.status === 400 &&
    'body' in err
  ) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
      },
    })
    return
  }

  // Mongoose validation errors
  if (typeof err === 'object' && err !== null && 'name' in err) {
    if (err.name === 'ValidationError') {
      res.status(400).json({
        error: {
          code: 'DATABASE_VALIDATION_ERROR',
          message: (err as Error).message,
        },
      })
      return
    }

    if (err.name === 'CastError') {
      res.status(400).json({
        error: {
          code: 'INVALID_IDENTIFIER',
          message: 'Invalid resource identifier format',
        },
      })
      return
    }
  }

  // MongoDB duplicate key error (code 11000)
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 11000
  ) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A resource with this key already exists',
      },
    })
    return
  }

  // Unhandled internal server error
  const errorMessage =
    err instanceof Error ? err.message : 'Unknown internal server error'

  // Log full error details securely on server only
  console.error('[SERVER ERROR]', {
    message: errorMessage,
    stack: err instanceof Error ? err.stack : undefined,
  })

  // Never expose raw exception stack traces to the frontend
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : errorMessage,
    },
  })
}

