// backend/src/imap/imap-poller.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ImapFlow, FetchMessageObject } from "imapflow";
import { SmtpRepository } from "../smtp/smtp.repository";
import { ImapIngestRepository } from "./imap-ingest.repository";

// Small helpers
const BOOL = (s?: string) => (s ? ["1", "true", "yes"].includes(s.toLowerCase()) : false);
const NUM = (s: string | undefined, d: number) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
};

const POLL_ENABLED = BOOL(process.env.IMAP_POLL_ENABLED);
const POLL_PURPOSE = (process.env.IMAP_POLL_PURPOSE || "alerts") as
    | "alerts"
    | "invites"
    | "password_resets"
    | "reports";
const EVERY_MS = NUM(process.env.IMAP_POLL_EVERY_MS, 120_000);
const MAX_PER_TICK = NUM(process.env.IMAP_POLL_MAX_PER_TICK, 50);
const MOVE_TO = (process.env.IMAP_MOVE_TO || "").trim(); // e.g., "Processed/Alerts"

// Reuse same idea as SMTP for TLS verify in dev/prod
const TLS_REJECT_UNAUTH = (() => {
    if (process.env.SMTP_TLS_REJECT_UNAUTHORIZED?.length) {
        const s = process.env.SMTP_TLS_REJECT_UNAUTHORIZED.toLowerCase();
        return s === "1" || s === "true" || s === "yes";
    }
    return process.env.NODE_ENV === "production";
})();

@Injectable()
export class ImapPollerService {
    private log = new Logger(ImapPollerService.name);
    private running = false;
    private lastRun = 0;

    constructor(
        private smtpRepo: SmtpRepository = new SmtpRepository(),
        private ingestRepo: ImapIngestRepository = new ImapIngestRepository()
    ) { }

    onModuleInit() {
        if (!POLL_ENABLED) {
            this.log.log("IMAP poller disabled by env.");
            return;
        }
        this.log.log(`IMAP poller started: purpose=${POLL_PURPOSE} every=${EVERY_MS}ms`);
        setTimeout(() => this.pollOnce().catch(() => { }), 1500);
    }

    // Tick often, but only actually run when our cadence elapsed.
    @Cron(CronExpression.EVERY_30_SECONDS)
    async tick() {
        if (!POLL_ENABLED) return;
        const now = Date.now();
        if (now - this.lastRun < EVERY_MS) return;
        this.lastRun = now;
        await this.pollOnce();
    }

    private async pollOnce() {
        if (this.running) return;
        this.running = true;
        let client: ImapFlow | null = null;

        try {
            const all = await this.smtpRepo.getAllRaw();
            const r = all[POLL_PURPOSE];
            if (!r?.imap_host || !r?.imap_port || !r?.imap_username) {
                this.log.debug(`IMAP ${POLL_PURPOSE}: not configured; skipping`);
                return;
            }

            client = new ImapFlow({
                host: r.imap_host,
                port: r.imap_port,
                secure: !!r.imap_use_ssl,
                auth: r.imap_username
                    ? { user: r.imap_username, pass: r.imap_password ?? undefined }
                    : undefined,
                logger: false,
                tls: { rejectUnauthorized: TLS_REJECT_UNAUTH },
                connectionTimeout: 10_000,
                greetingTimeout: 10_000,
            });

            await client.connect();
            await client.mailboxOpen("INBOX", { readOnly: false });

            const unseen = await client.search({ seen: false });
            if (!unseen || unseen.length === 0) {
                this.log.debug(`IMAP ${POLL_PURPOSE}: no new unseen mail.`);
                return;
            }

            const candidates = unseen.slice(0, MAX_PER_TICK);
            this.log.log(`IMAP ${POLL_PURPOSE}: ${unseen.length} unseen message(s).`);

            for (const uid of candidates) {
                const msg = await client.fetchOne(uid, {
                    source: true,
                    envelope: true,
                    internalDate: true,
                    size: true,
                });
                await this.handleMessage(POLL_PURPOSE, uid, msg);

                // Mark seen
                await client.messageFlagsAdd({ uid }, ["\\Seen"]);

                // Move if configured (folder must exist)
                if (MOVE_TO) {
                    try {
                        await client.messageMove({ uid }, MOVE_TO);
                    } catch (e) {
                        this.log.warn(`Move to "${MOVE_TO}" failed for UID=${uid}: ${(e as any)?.message || e}`);
                    }
                }
            }
        } catch (e) {
            this.log.error(`Poll failed: ${(e as any)?.message || e}`, e as any);
        } finally {
            try {
                if (client) await client.logout();
            } catch {
                /* noop */
            }
            this.running = false;
        }
    }

    private getHeader(raw: string, name: string): string | undefined {
        const rx = new RegExp(`^${name}:\\s*(.+)$`, "gmi");
        const m = rx.exec(raw);
        if (!m) return undefined;
        return m[1]?.trim();
    }

    /**
     * Lightweight DSN bounce detection.
     */
    private parseBounce(raw: string) {
        const hdrFrom = this.getHeader(raw, "From") || "";
        const contentType = this.getHeader(raw, "Content-Type") || "";

        const looksLikeMailerDaemon =
            /mailer-daemon|postmaster/i.test(hdrFrom) ||
            /Delivery Status Notification|Undelivered Mail Returned to Sender/i.test(
                this.getHeader(raw, "Subject") || ""
            );

        const isDsn =
            /multipart\/report/i.test(contentType) &&
            /report-type\s*=\s*["']?delivery-status["']?/i.test(contentType);

        if (!looksLikeMailerDaemon && !isDsn) {
            return null;
        }

        const finalRecipient =
            (raw.match(/Final-Recipient:\s*[^;]+;\s*([^\r\n]+)/i) || [])[1] || undefined;
        const action = (raw.match(/Action:\s*([^\r\n]+)/i) || [])[1] || undefined;
        const status = (raw.match(/Status:\s*([^\r\n]+)/i) || [])[1] || undefined;
        const diag =
            (raw.match(/Diagnostic-Code:\s*[^;]+;\s*([^\r\n]+)/i) || [])[1] ||
            (raw.match(/Diagnostic-Code:\s*([^\r\n]+)/i) || [])[1] ||
            undefined;

        if ((action || status) && finalRecipient) {
            return { recipient: finalRecipient, action, status, diagnostic: diag };
        }
        if (looksLikeMailerDaemon) {
            return { recipient: finalRecipient, action: action || "failed", status, diagnostic: diag };
        }
        return null;
    }

    private async handleMessage(
        purpose: "alerts" | "invites" | "password_resets" | "reports",
        uid: number,
        msg: FetchMessageObject | false
    ) {
        if (!msg || !msg.envelope) return;

        const from = msg.envelope.from?.[0]?.address || msg.envelope.from?.[0]?.name || "";
        const subject = msg.envelope.subject || "";
        const size = msg.size || 0;

        // Convert Buffer to string safely for header parsing
        const raw = (msg as any).source
            ? Buffer.isBuffer((msg as any).source)
                ? (msg as any).source.toString("utf8")
                : String((msg as any).source)
            : "";

        const headersSnippet = raw ? raw.substring(0, 4000) : undefined;

        // Detect DSN bounce
        const bounce = raw ? this.parseBounce(raw) : null;
        const isBounce = !!bounce;

        // Persist
        await this.ingestRepo.insertIngested({
            purpose,
            uid,
            from_addr: from || null,
            subject: subject || null,
            size_bytes: size,
            headers_snippet: headersSnippet,
            is_bounce: isBounce,
            bounce_recipient: bounce?.recipient || null,
            bounce_status: bounce?.status || null,
            bounce_action: bounce?.action || null,
            bounce_diagnostic: bounce?.diagnostic || null,
        });

        if (isBounce) {
            this.log.warn(
                `Bounce detected: purpose=${purpose} uid=${uid} to=${bounce?.recipient} status=${bounce?.status} action=${bounce?.action}`
            );
            // TODO: suppress or mark recipient invalid here
        } else {
            this.log.log(`Inbound: from=${from} subject=${JSON.stringify(subject)} size=${size}`);
            // TODO: route into tickets/alerts here
        }
    }
}
