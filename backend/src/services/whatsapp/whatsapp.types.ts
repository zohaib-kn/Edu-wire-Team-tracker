/**
 * WhatsApp Provider Types and Contracts for Senior Developer Handoff
 */

export type WhatsAppTemplateName =
  | 'daily_pending_report'
  | 'task_overdue'
  | 'weekly_summary'
  | string

export interface SendTemplateInput {
  recipient: string // E.164 phone number, e.g. '+919876543210'
  templateName: WhatsAppTemplateName
  parameters: Record<string, string>
  idempotencyKey: string
}

export interface SendTemplateResult {
  accepted: boolean
  providerMessageId?: string
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  skipReason?: string
  rawResponse?: Record<string, unknown>
}

export interface WhatsAppProvider {
  readonly name: string
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>
}

