import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk'
import { User } from '../models/User.js'

export interface PushNotificationPayload {
  to: string | string[]
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
  priority?: 'default' | 'normal' | 'high'
  sound?: 'default' | null
}

export interface PushSendResult {
  accepted: boolean
  status: 'sent' | 'failed' | 'skipped'
  ticketsCount: number
  error?: string
  skipReason?: string
  invalidTokensPruned: string[]
}

class ExpoService {
  private expoClient: Expo
  private mockMode: boolean = process.env.NODE_ENV === 'test' || Boolean(process.env.USE_MOCK_PUSH)
  private mockDispatched: Array<{ payload: PushNotificationPayload; result: PushSendResult }> = []
  private simulatedErrors: Set<string> = new Set()

  constructor() {
    this.expoClient = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
    })
  }

  setMockMode(enabled: boolean): void {
    this.mockMode = enabled
  }

  isMockMode(): boolean {
    return this.mockMode
  }

  isValidExpoToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false
    // Allow standard ExponentPushToken[...] or ExpoPushToken[...] or test mock tokens
    if (this.mockMode && token.startsWith('ExponentPushToken[')) return true
    return Expo.isExpoPushToken(token)
  }

  /**
   * Dispatches push notifications to a user's registered devices.
   * Cleans up invalid/unregistered device tokens automatically.
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<PushSendResult> {
    const rawTokens = Array.isArray(payload.to) ? payload.to : [payload.to]
    const validTokens = rawTokens.filter((t) => this.isValidExpoToken(t))

    if (validTokens.length === 0) {
      const skipResult: PushSendResult = {
        accepted: false,
        status: 'skipped',
        ticketsCount: 0,
        skipReason: 'NO_VALID_PUSH_TOKENS',
        invalidTokensPruned: [],
      }
      if (this.mockMode) {
        this.mockDispatched.push({ payload, result: skipResult })
      }
      return skipResult
    }

    // Mock mode branch (used in automated test suites or sandbox)
    if (this.mockMode) {
      const invalidTokensPruned: string[] = []

      for (const token of validTokens) {
        if (this.simulatedErrors.has(token) || token.includes('invalid-token')) {
          invalidTokensPruned.push(token)
          // Prune from database
          await User.findByIdAndUpdate(payload.userId, {
            $pull: { pushTokens: token },
          }).exec()
        }
      }

      const hasValidRemaining = validTokens.some((t) => !invalidTokensPruned.includes(t))

      const result: PushSendResult = hasValidRemaining
        ? {
            accepted: true,
            status: 'sent',
            ticketsCount: validTokens.length - invalidTokensPruned.length,
            invalidTokensPruned,
          }
        : {
            accepted: false,
            status: 'failed',
            error: 'All registered device tokens are invalid or expired',
            ticketsCount: 0,
            invalidTokensPruned,
          }

      this.mockDispatched.push({ payload, result })
      return result
    }

    // Real Expo Push Service
    try {
      const messages: ExpoPushMessage[] = validTokens.map((pushToken) => ({
        to: pushToken,
        sound: payload.sound ?? 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        priority: payload.priority ?? 'high',
      }))

      const chunks = this.expoClient.chunkPushNotifications(messages)
      const tickets: ExpoPushTicket[] = []
      const invalidTokensPruned: string[] = []

      for (const chunk of chunks) {
        const ticketChunk = await this.expoClient.sendPushNotificationsAsync(chunk)
        tickets.push(...ticketChunk)

        // Inspect tickets for token invalidation
        ticketChunk.forEach((ticket, idx) => {
          if (ticket.status === 'error') {
            const token = chunk[idx].to as string
            if (ticket.details?.error === 'DeviceNotRegistered') {
              invalidTokensPruned.push(token)
            }
          }
        })
      }

      // Automatically prune unregistered devices from User model
      if (invalidTokensPruned.length > 0) {
        await User.findByIdAndUpdate(payload.userId, {
          $pull: { pushTokens: { $in: invalidTokensPruned } },
        }).exec()
      }

      const hasSuccess = tickets.some((t) => t.status === 'ok')

      return {
        accepted: hasSuccess,
        status: hasSuccess ? 'sent' : 'failed',
        ticketsCount: tickets.filter((t) => t.status === 'ok').length,
        invalidTokensPruned,
      }
    } catch (err: any) {
      return {
        accepted: false,
        status: 'failed',
        error: err.message || 'Error communicating with Expo Push API',
        ticketsCount: 0,
        invalidTokensPruned: [],
      }
    }
  }

  // --- Test / Inspection Helpers ---

  getMockDispatched() {
    return [...this.mockDispatched]
  }

  clearMockDispatched() {
    this.mockDispatched = []
    this.simulatedErrors.clear()
  }

  simulateInvalidToken(token: string) {
    this.simulatedErrors.add(token)
  }
}

export const expoService = new ExpoService()

