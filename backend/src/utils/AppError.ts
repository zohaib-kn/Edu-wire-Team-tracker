export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly isOperational: boolean

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message = 'Invalid request payload or parameters', code = 'INVALID_REQUEST'): AppError {
    return new AppError(message, 400, code)
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED'): AppError {
    return new AppError(message, 401, code)
  }

  static forbidden(message = 'Access denied: insufficient permissions', code = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, code)
  }

  static notFound(message = 'The requested resource was not found', code = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, code)
  }

  static conflict(message = 'A resource with these details already exists', code = 'CONFLICT'): AppError {
    return new AppError(message, 409, code)
  }

  static tooManyRequests(message = 'Too many requests. Please try again later', code = 'RATE_LIMITED'): AppError {
    return new AppError(message, 429, code)
  }

  static serviceUnavailable(message = 'Database or service temporarily unavailable', code = 'SERVICE_UNAVAILABLE'): AppError {
    return new AppError(message, 503, code)
  }
}

