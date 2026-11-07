import type {
  WhatsAppProvider,
  SendTemplateInput,
  SendTemplateResult,
} from './whatsapp.types.js'

export interface MockSentMessage {
  input: SendTemplateInput
  result: SendTemplateResult
  timestamp: Date
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'MockWhatsAppProvider'
  private sentMessages: MockSentMessage[] = []
  private simulatedErrors: Map<string, string> = new Map()

  /**
   * Simulates WhatsApp template delivery without external HTTP calls.
   */
  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    const rawRecipient = (input.recipient || '').trim()

    // 1. Validate recipient phone number
    if (!rawRecipient || rawRecipient.length < 8) {
      const skipResult: SendTemplateResult = {
        accepted: false,
        status: 'skipped',
        skipReason: 'MISSING_OR_INVALID_PHONE_NUMBER',
        error: 'Recipient has no valid phone number registered',
      }
      this.sentMessages.push({ input, result: skipResult, timestamp: new Date() })
      return skipResult
    }

    // 2. Check for configured simulated error (for failure/retry testing)
    if (this.simulatedErrors.has(input.templateName)) {
      const errMsg = this.simulatedErrors.get(input.templateName)!
      const failResult: SendTemplateResult = {
        accepted: false,
        status: 'failed',
        error: errMsg,
      }
      this.sentMessages.push({ input, result: failResult, timestamp: new Date() })
      return failResult
    }

    // 3. Successful simulated delivery
    const providerMessageId = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const successResult: SendTemplateResult = {
      accepted: true,
      status: 'sent',
      providerMessageId,
      rawResponse: {
        messaging_product: 'whatsapp',
        contacts: [{ input: rawRecipient, wa_id: rawRecipient.replace(/\D/g, '') }],
        messages: [{ id: providerMessageId }],
      },
    }

    this.sentMessages.push({ input, result: successResult, timestamp: new Date() })
    return successResult
  }

  // --- Test & Inspection Helpers ---

  getSentMessages(): MockSentMessage[] {
    return [...this.sentMessages]
  }

  findSentMessage(predicate: (m: MockSentMessage) => boolean): MockSentMessage | undefined {
    return this.sentMessages.find(predicate)
  }

  clearSentMessages(): void {
    this.sentMessages = []
    this.simulatedErrors.clear()
  }

  simulateError(templateName: string, errorMessage: string): void {
    this.simulatedErrors.set(templateName, errorMessage)
  }

  clearSimulatedError(templateName: string): void {
    this.simulatedErrors.delete(templateName)
  }
}

export const mockWhatsAppProvider = new MockWhatsAppProvider()

