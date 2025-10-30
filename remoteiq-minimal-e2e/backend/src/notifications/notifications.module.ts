import { Module } from '@nestjs/common';

/**
 * Stub module to host notification providers later.
 * We intentionally export nothing for now to avoid accidental usage.
 * When implemented, add:
 *  - NotificationsService
 *  - EmailProvider (SMTP, templating)
 *  - WebhookProvider (signed requests, retry/backoff)
 * All providers must redact secrets when logged and store them encrypted at rest.
 */
@Module({})
export class NotificationsModule { }
