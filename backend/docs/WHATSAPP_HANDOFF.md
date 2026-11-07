# WhatsApp Business API — Senior Developer Integration Handoff

## 1. Overview
This module defines the WhatsApp messaging contracts, payload structures, queuing, idempotency, and retry infrastructure for the **Edu Wire Team Tracker** platform.

Per architectural requirements, actual live WhatsApp Business API HTTP calls are isolated to this clean adapter boundary. The senior developer can plug in the real Cloud API or On-Premises provider without altering queue consumers, notification logging, or business services.

---

## 2. Adapter Contract & Location

- **Interface Location**: `backend/src/services/whatsapp/whatsapp.types.ts`
- **Active Service**: `backend/src/services/whatsapp/whatsapp.service.ts`
- **Mock Implementation**: `backend/src/services/whatsapp/mock.provider.ts`

### TypeScript Interface:
```typescript
export interface SendTemplateInput {
  recipient: string                // E.164 phone number (e.g. "+919876543210")
  templateName: string             // Registered Meta WhatsApp template name
  parameters: Record<string, string> // Template variable substitutions
  idempotencyKey: string          // Unique per job/schedule occurrence
}

export interface SendTemplateResult {
  accepted: boolean
  providerMessageId?: string       // WAMID from Meta (e.g. "wamid.HBgM...")
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  skipReason?: string
  rawResponse?: Record<string, unknown>
}

export interface WhatsAppProvider {
  readonly name: string
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>
}
```

### Registration:
To connect the live provider, instantiate your adapter implementing `WhatsAppProvider` and call:
```typescript
import { whatsappService } from '../services/whatsapp/whatsapp.service.js'
import { MetaWhatsAppProvider } from './metaWhatsAppProvider.js'

whatsappService.registerProvider(new MetaWhatsAppProvider({
  apiToken: process.env.WHATSAPP_API_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
}))
```

---

## 3. Environment Variables Required

Add the following to `.env` when integrating the live provider:
```env
# WhatsApp Business Cloud API Configuration
WHATSAPP_API_TOKEN=EAA...
WHATSAPP_PHONE_NUMBER_ID=109876543210987
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secure_verify_token

# Feature Flags
USE_MOCK_WHATSAPP=false # Set to true to force mock transport during local development
```

---

## 4. Expected Message Templates & Parameters

The platform queues WhatsApp messages for three distinct schedules. Each uses standard Meta WhatsApp utility templates:

### A. Template: `daily_pending_report`
- **Schedule**: Daily at 9:30 AM IST
- **Target Audience**: Team Leads (scoped to team) and Branch Admins (scoped to branch).
- **Parameters**:
  - `{{recipient_name}}`: Recipient staff name
  - `{{report_date}}`: IST Date string (`YYYY-MM-DD`)
  - `{{total_pending}}`: Total number of incomplete tasks
  - `{{high_priority_count}}`: Total number of high priority incomplete tasks
  - `{{overdue_count}}`: Overdue task count
  - `{{report_summary}}`: Formatted multiline task brief

### B. Template: `task_overdue`
- **Schedule**: Daily at 10:00 AM IST
- **Target Audience**: Task Owners with incomplete tasks past their due date (`due < today IST`).
- **Parameters**:
  - `{{employee_name}}`: Assigned employee full name
  - `{{task_title}}`: Title of overdue task
  - `{{due_date}}`: Original due date (`YYYY-MM-DD`)
  - `{{deep_link_url}}`: Deep link (`edutracker://tasks/{id}`)

### C. Template: `weekly_summary`
- **Schedule**: Monday at 9:30 AM IST
- **Target Audience**: Active Super Admins.
- **Parameters**:
  - `{{admin_name}}`: Super Admin name
  - `{{period_label}}`: 7-day period (e.g. `Nov 01, 2026 – Nov 07, 2026`)
  - `{{total_completed}}`: Total completed tasks across system
  - `{{total_pending}}`: Total pending tasks across system
  - `{{completion_rate}}`: Completion percentage (`XX%`)
  - `{{breakdown_summary}}`: Multiline team-by-team summary

---

## 5. Idempotency & Retry Behaviour
1. **Queue Configuration**:
   - Queue Name: `whatsapp-reports`
   - Attempts: 3
   - Exponential Backoff: Initial delay 2000 ms (2s, 4s, 8s)
2. **Deduplication Keys**:
   - Format: `[template_name]:[entity_id]:[recipient_id]:whatsapp:[date_key]`
   - Example: `daily_pending_report:branch_123:user_456:whatsapp:2026-11-06`
   - If a duplicate job is enqueued, BullMQ deduplicates via `jobId`, preventing repeated sends.
3. **Database Audit**:
   - Each attempt updates the MongoDB `Notification` collection with status (`queued` $\rightarrow$ `processing` $\rightarrow$ `sent` | `failed` | `skipped`), `jobId`, and `providerResponse`.
4. **Permanent vs Transient Errors**:
   - Missing or malformed phone numbers ($<8$ digits) return `status: 'skipped'`, recording `skipReason: 'MISSING_OR_INVALID_PHONE_NUMBER'`. These are NOT retried.
   - HTTP 429 (Rate Limit) or 5xx from Meta should throw so BullMQ can trigger exponential backoff.
   - HTTP 400 (Template does not exist or parameter mismatch) should return `status: 'failed'` to avoid endless queue loops.

---

## 6. Testing Instructions
- Unit and integration tests can be run at any time with:
  ```bash
  npm --prefix backend run test:phase5-part1
  npm --prefix backend run test:phase5-part2
  ```
- The mock provider is enabled by default during automated testing. All sent messages can be inspected through `mockWhatsAppProvider.getSentMessages()`.

