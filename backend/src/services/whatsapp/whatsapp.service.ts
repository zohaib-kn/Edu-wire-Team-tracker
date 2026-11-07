import { env } from '../../config/env.js'
import type {
  WhatsAppProvider,
  SendTemplateInput,
  SendTemplateResult,
} from './whatsapp.types.js'
import { mockWhatsAppProvider } from './mock.provider.js'

class WhatsAppService {
  private activeProvider: WhatsAppProvider

  constructor() {
    // Default to mock provider in development/test or if USE_MOCK_WHATSAPP is enabled
    this.activeProvider = mockWhatsAppProvider
  }

  /**
   * Allows the senior developer to register the real WhatsApp Business API provider adapter.
   */
  registerProvider(provider: WhatsAppProvider): void {
    console.log(`[WHATSAPP] Registered provider: ${provider.name}`)
    this.activeProvider = provider
  }

  getActiveProvider(): WhatsAppProvider {
    return this.activeProvider
  }

  /**
   * Sends a template message through the active provider.
   * Fails safely if in production without a configured provider.
   */
  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    if (
      process.env.NODE_ENV === 'production' &&
      !env.USE_MOCK_REDIS &&
      this.activeProvider === mockWhatsAppProvider &&
      !process.env.USE_MOCK_WHATSAPP
    ) {
      console.warn(
        '[WHATSAPP] ⚠️ Production environment detected but no real WhatsApp provider configured. Failing safely.',
      )
      return {
        accepted: false,
        status: 'failed',
        error: 'WHATSAPP_PROVIDER_NOT_CONFIGURED: Production provider pending senior developer handoff.',
      }
    }

    return this.activeProvider.sendTemplate(input)
  }
}

export const whatsappService = new WhatsAppService()

