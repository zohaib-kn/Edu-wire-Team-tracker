import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import type { CookieOptions } from 'express'
import { env } from '../config/env.js'

export interface AccessTokenPayload {
  userId: string
  email: string
  role: string
}

export const REFRESH_COOKIE_NAME = 'refreshToken'
export const REFRESH_TOKEN_EXPIRY_DAYS = 30

export const tokenService = {
  /**
   * Generates a short-lived 15-minute JWT access token.
   */
  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    })
  },

  /**
   * Verifies and decodes an access token.
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
  },

  /**
   * Generates a cryptographically secure random refresh token.
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex')
  },

  /**
   * Computes SHA-256 hash of a refresh token for safe storage in MongoDB.
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  },

  /**
   * Base cookie attributes shared by set-cookie and clearCookie calls.
   */
  getClearRefreshCookieOptions(): CookieOptions {
    const isProduction = env.NODE_ENV === 'production'
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
    }
  },

  /**
   * Safe cookie options for web refresh tokens.
   */
  getRefreshCookieOptions(): CookieOptions {
    return {
      ...this.getClearRefreshCookieOptions(),
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    }
  },
}

