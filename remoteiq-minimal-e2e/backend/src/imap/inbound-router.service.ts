import { Injectable, Logger } from "@nestjs/common";

export type InboundPurpose = "alerts" | "invites" | "password_resets" | "reports";

export interface InboundMessage {
    purpose: InboundPurpose;
    from?: string;
    subject?: string;
    text?: string;
    size?: number;
    envelope?: { from?: string; messageId?: string };
    rawId?: string | number; // IMAP UID or similar
}

export interface RouteResult {
    action: "drop" | "ticket.update" | "ticket.new" | "alert" | "bounce" | "unknown";
    matched?: string;
    ticketId?: string;
    reason?: string;
}

const ticketTag = /\[TICKET:#(\d+)\]/i;

@Injectable()
export class InboundRouter {
    private readonly logger = new Logger(InboundRouter.name);

    /** Very small “router”: decide what to do with an inbound email. */
    route(msg: InboundMessage): RouteResult {
        // 1) Bounces should already be detected by poller and labeled, but double-check here.
        if (this.looksLikeBounce(msg)) {
            this.logger.log(`Routed as bounce (from=${msg.from} subject="${msg.subject}")`);
            return { action: "bounce", matched: "bounce", reason: "dsn/bounce heuristic" };
        }

        // 2) Ticket tagging in subject: [TICKET:#1234]
        const m = (msg.subject || "").match(ticketTag);
        if (m?.[1]) {
            const ticketId = m[1];
            this.logger.log(`Routed as ticket.update (ticket #${ticketId})`);
            // TODO: call your TicketService.updateTicketFromEmail(...)
            return { action: "ticket.update", matched: "subject:[TICKET:#]", ticketId };
        }

        // 3) Mailbox-based routing (alerts mailbox → alert)
        if (msg.purpose === "alerts") {
            this.logger.log(`Routed as alert (purpose=alerts)`);
            // TODO: call your AlertService.ingest(...)
            return { action: "alert", matched: "purpose:alerts" };
        }

        // 4) Fallback: create a new ticket for support-like mailboxes
        if (msg.purpose === "reports" || msg.purpose === "invites") {
            this.logger.log(`Routed as ticket.new (purpose=${msg.purpose})`);
            // TODO: call your TicketService.createFromEmail(...)
            return { action: "ticket.new", matched: "purpose:new-ticket" };
        }

        this.logger.warn(`Unknown routing. Dropping (from=${msg.from} subject="${msg.subject}")`);
        return { action: "unknown" };
    }

    private looksLikeBounce(msg: InboundMessage): boolean {
        const from = (msg.from || "").toLowerCase();
        const subj = (msg.subject || "").toLowerCase();
        const txt = (msg.text || "").toLowerCase();

        const fromMatches =
            from.includes("mailer-daemon@") ||
            from.includes("postmaster@") ||
            from.includes("mail delivery subsystem");

        const subjectMatches =
            subj.includes("undelivered mail returned to sender") ||
            subj.includes("delivery status notification") ||
            subj.includes("delivery failure") ||
            subj.includes("mail failure") ||
            subj.includes("bounce");

        const bodyHints =
            txt.includes("status: 5.") ||
            txt.includes("status: 4.") ||
            txt.includes("diagnostic-code:") ||
            txt.includes("final-recipient") ||
            txt.includes("permanent error") ||
            txt.includes("permanent failure");

        return fromMatches || subjectMatches || bodyHints;
    }
}
