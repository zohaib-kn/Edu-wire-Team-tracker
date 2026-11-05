import axios, { type AxiosError } from 'axios'
import type { ApiErrorResponse } from '@/features/auth/types/auth.types'

export interface ParsedApiError {
  code?: string
  message: string
  status?: number
  isNetworkError: boolean
}

/**
 * Extracts a friendly, user-facing error message from API responses or network failures.
 * Never displays raw stack traces or cryptic internal representations.
 */
export function extractApiError(error: unknown): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) {
      return {
        message: error.message || 'An unexpected error occurred. Please try again.',
        isNetworkError: false,
      }
    }
    return {
      message: 'An unexpected error occurred. Please try again.',
      isNetworkError: false,
    }
  }

  const axiosError = error as AxiosError<ApiErrorResponse>

  // Network or server unreachable error
  if (!axiosError.response) {
    if (axiosError.code === 'ERR_NETWORK' || axiosError.message.includes('Network Error')) {
      return {
        code: 'NETWORK_ERROR',
        message:
          'Unable to connect to the authentication server. Please ensure the backend service is running and try again.',
        isNetworkError: true,
      }
    }
    return {
      code: axiosError.code,
      message: axiosError.message || 'Unable to communicate with the server.',
      isNetworkError: true,
    }
  }

  const status = axiosError.response.status
  const data = axiosError.response.data

  const errorCode = data?.error?.code
  const serverMessage = data?.error?.message || data?.message

  // Custom mapping for specific API error codes
  if (errorCode) {
    switch (errorCode.toUpperCase()) {
      case 'INVALID_CREDENTIALS':
        return {
          code: errorCode,
          status,
          message: 'Invalid email or password. Please verify your credentials.',
          isNetworkError: false,
        }
      case 'ACCOUNT_LOCKED':
        return {
          code: errorCode,
          status,
          message: 'Your account has been locked. Please contact your system administrator.',
          isNetworkError: false,
        }
      case 'INACTIVE_ACCOUNT':
        return {
          code: errorCode,
          status,
          message: 'This account is currently inactive. Please contact an administrator.',
          isNetworkError: false,
        }
      case 'SESSION_EXPIRED':
        return {
          code: errorCode,
          status,
          message: 'Your session has expired. Please sign in again.',
          isNetworkError: false,
        }
      case 'INSUFFICIENT_PERMISSIONS':
        return {
          code: errorCode,
          status,
          message: 'You do not have permission to perform this action.',
          isNetworkError: false,
        }
      case 'PASSWORD_REQUIREMENTS_NOT_MET':
        return {
          code: errorCode,
          status,
          message: serverMessage || 'The new password does not meet security requirements.',
          isNetworkError: false,
        }
      default:
        if (serverMessage) {
          return { code: errorCode, status, message: serverMessage, isNetworkError: false }
        }
    }
  }

  // Fallback based on HTTP status codes
  switch (status) {
    case 400:
      return {
        code: 'BAD_REQUEST',
        status,
        message: serverMessage || 'The request was invalid. Please check your submission.',
        isNetworkError: false,
      }
    case 401:
      return {
        code: 'UNAUTHORIZED',
        status,
        message: serverMessage || 'Invalid credentials or your session has expired.',
        isNetworkError: false,
      }
    case 403:
      return {
        code: 'FORBIDDEN',
        status,
        message: serverMessage || 'You do not have permission to access this resource.',
        isNetworkError: false,
      }
    case 404:
      return {
        code: 'NOT_FOUND',
        status,
        message: serverMessage || 'The requested resource was not found.',
        isNetworkError: false,
      }
    case 429:
      return {
        code: 'TOO_MANY_REQUESTS',
        status,
        message: 'Too many requests. Please wait a moment before trying again.',
        isNetworkError: false,
      }
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        code: 'SERVER_ERROR',
        status,
        message: 'Server error encountered. Please try again later.',
        isNetworkError: false,
      }
    default:
      return {
        code: errorCode || 'UNKNOWN_ERROR',
        status,
        message: serverMessage || 'An unexpected error occurred. Please try again.',
        isNetworkError: false,
      }
  }
}

