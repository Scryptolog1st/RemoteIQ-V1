// backend/src/smtp/smtp.service.ts

import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import net from "net";
import tls from "tls";
import { promises as dns } from "dns";
import { SmtpRepository, EmailSettingsRow, EmailPurpose } from "./smtp.repository";
import { DkimRepository } from "./dkim.repository";

// Core SMTP options we care about (we'll cast to nodemailer at creation time)
type SmtpOpts = {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass?: string };
    tls?: { rejectUnauthorized?: boolean };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    // nodemailer extras (accepted via cast)
    pool?: boolean;
    maxConnections?: number;
    maxMessages?: number;
    dkim?: {
        domainName: string;
        keySelector: string;
        privateKey: string;
    };
};

type EmailProfile = {
    enabled: boolean;
    smtp: {
        host: string;
        port?: number;
        username: string;
        password?: string;
        useTLS: boolean;
        useSSL: boolean;
        fromAddress: string;
    };
    imap: { host: string; port?: number; username: string; password?: string; useSSL: boolean };
    pop: { host: string; port?: number; username: string; password?: string; useSSL: boolean };
};
type EmailConfig = { profiles: Record<EmailPurpose, EmailProfile>; lastUpdated?: string };

const NUM = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
};

// TLS verification toggle: default true in prod
const TLS_REJECT_UNAUTH = (() => {
    if (process.env.SMTP_TLS_REJECT_UNAUTHORIZED?.length) {
        const s = process.env.SMTP_TLS_REJECT_UNAUTHORIZED.toLowerCase();
        return s === "1" || s === "true" || s === "yes";
    }
    return process.env.NODE_ENV === "production";
})();

// Timeouts
const CONNECTION_TIMEOUT = NUM(process.env.SMTP_CONNECTION_TIMEOUT, 10_000);
const GREETING_TIMEOUT = NUM(process.env.SMTP_GREETING_TIMEOUT, 10_000);
const SOCKET_TIMEOUT = NUM(process.env.SMTP_SOCKET_TIMEOUT, 12_000);

// Optional recipient guard in non-prod: force a specific domain
const TEST_DOMAIN = (process.env.SMTP_TEST_DOMAIN || "").trim();

@Injectable()
export class SmtpService {
    constructor(
        private repo: SmtpRepository = new SmtpRepository(),
        private dkimRepo: DkimRepository = new DkimRepository()
    ) { }

    /** GET config (secrets omitted) */
    async getConfig(): Promise<EmailConfig> {
        const all = await this.repo.getAllRaw();

        const toProfile = (r: EmailSettingsRow): EmailProfile => ({
            enabled: r.enabled,
            smtp: {
                host: r.smtp_host,
                port: r.smtp_port ?? undefined,
                username: r.smtp_username,
                // password omitted
                useTLS: r.smtp_use_tls,
                useSSL: r.smtp_use_ssl,
                fromAddress: r.smtp_from_address,
            },
            imap: { host: r.imap_host, port: r.imap_port ?? undefined, username: r.imap_username, useSSL: r.imap_use_ssl },
            pop: { host: r.pop_host, port: r.pop_port ?? undefined, username: r.pop_username, useSSL: r.pop_use_ssl },
        });

        const profiles = Object.fromEntries(
            (Object.keys(all) as EmailPurpose[]).map((p) => [p, toProfile(all[p])])
        ) as Record<EmailPurpose, EmailProfile>;

        const lastUpdated = Object.values(all)
            .map((r) => r.updated_at)
            .sort()
            .slice(-1)[0];

        return { profiles, lastUpdated };
    }

    /** POST save (preserve secrets when not provided) */
    async saveConfig(incoming: EmailConfig): Promise<void> {
        const purposes = Object.keys(incoming.profiles) as EmailPurpose[];
        for (const purpose of purposes) {
            const cur = incoming.profiles[purpose];

            const patch: Partial<EmailSettingsRow> = {
                enabled: !!cur.enabled,

                smtp_host: cur.smtp.host,
                smtp_port: cur.smtp.port ?? null,
                smtp_username: cur.smtp.username,
                smtp_use_tls: cur.smtp.useTLS,
                smtp_use_ssl: cur.smtp.useSSL,
                smtp_from_address: cur.smtp.fromAddress,

                imap_host: cur.imap.host,
                imap_port: cur.imap.port ?? null,
                imap_username: cur.imap.username,
                imap_use_ssl: cur.imap.useSSL,

                pop_host: cur.pop.host,
                pop_port: cur.pop.port ?? null,
                pop_username: cur.pop.username,
                pop_use_ssl: cur.pop.useSSL,
            };

            // Only update secrets when a new value is given
            if (cur.smtp.password) patch.smtp_password = cur.smtp.password;
            if (cur.imap.password) patch.imap_password = cur.imap.password;
            if (cur.pop.password) patch.pop_password = cur.pop.password;

            await this.repo.upsertOne(purpose, patch);
        }
    }

    /** Attach DKIM from DB (priority) or .env fallback */
    private async attachDkim(extended: any) {
        try {
            const row = await this.dkimRepo.get();
            if (row?.domain && row?.selector && row?.private_key) {
                extended.dkim = {
                    domainName: row.domain,
                    keySelector: row.selector,
                    privateKey: row.private_key,
                };
                return;
            }
        } catch {
            // ignore and fall back to env
        }

        const dkimDomain = (process.env.DKIM_DOMAIN || "").trim();
        const dkimSelector = (process.env.DKIM_KEY_SELECTOR || "").trim();
        const dkimKey = process.env.DKIM_PRIVATE_KEY?.replace(/\\n/g, "\n")?.trim();
        if (dkimDomain && dkimSelector && dkimKey) {
            extended.dkim = { domainName: dkimDomain, keySelector: dkimSelector, privateKey: dkimKey };
        }
    }

    /** Build nodemailer transport options (async because DKIM may be DB-backed) */
    private async buildTransport(r: EmailSettingsRow) {
        if (!r.smtp_host || !r.smtp_port) {
            return { opts: null as SmtpOpts | null, message: "SMTP not configured" };
        }

        const base: SmtpOpts = {
            host: r.smtp_host,
            port: r.smtp_port,
            secure: !!r.smtp_use_ssl,
            auth: r.smtp_username ? { user: r.smtp_username, pass: r.smtp_password ?? undefined } : undefined,
            tls: { rejectUnauthorized: TLS_REJECT_UNAUTH },
            connectionTimeout: CONNECTION_TIMEOUT,
            greetingTimeout: GREETING_TIMEOUT,
            socketTimeout: SOCKET_TIMEOUT,
        };

        const usePool = (process.env.SMTP_POOL || "").toLowerCase() === "true";
        const maxConn = NUM(process.env.SMTP_POOL_MAX_CONN, 2);
        const maxMsg = NUM(process.env.SMTP_POOL_MAX_MSG, 50);

        const extended: any = { ...base };
        if (usePool) {
            extended.pool = true;
            extended.maxConnections = maxConn;
            extended.maxMessages = maxMsg;
        }

        await this.attachDkim(extended);

        return { opts: extended as SmtpOpts, message: null as string | null };
    }

    private nodemailerTransport(opts: SmtpOpts) {
        // Cast to any to accept pool/dkim options without fighting the narrow TS type
        return nodemailer.createTransport(opts as any);
    }

    private formatMailError(e: any): string {
        if (!e) return "Unknown error";
        const parts: string[] = [];
        if (e.code) parts.push(`code=${e.code}`);
        if (e.responseCode) parts.push(`smtp=${e.responseCode}`);
        if (e.command) parts.push(`cmd=${e.command}`);
        if (e.response) parts.push(String(e.response).trim());
        if (e.message && parts.length === 0) parts.push(e.message);
        return parts.join(" | ") || "Send failed";
    }

    async testSmtp(purpose: EmailPurpose) {
        const all = await this.repo.getAllRaw();
        const r = all[purpose];

        const { opts, message } = await this.buildTransport(r);
        if (!opts) return { ok: false, result: message! };

        try {
            const transporter = this.nodemailerTransport(opts);
            await transporter.verify();
            return { ok: true, result: "SMTP connection verified" };
        } catch (e: any) {
            return { ok: false, result: this.formatMailError(e) };
        }
    }

    async sendTest(purpose: EmailPurpose, to: string, subject?: string, body?: string) {
        if (TEST_DOMAIN && !to.toLowerCase().endsWith(`@${TEST_DOMAIN.toLowerCase()}`)) {
            return { ok: false, result: `Recipient must be @${TEST_DOMAIN} in this environment` };
        }

        const all = await this.repo.getAllRaw();
        const r = all[purpose];
        if (!r?.smtp_host || !r?.smtp_port || !r?.smtp_from_address) {
            return { ok: false, result: "SMTP not fully configured" };
        }

        const { opts, message } = await this.buildTransport(r);
        if (!opts) return { ok: false, result: message! };

        try {
            const transporter = this.nodemailerTransport(opts);
            await transporter.sendMail({
                from: r.smtp_from_address,
                to,
                subject: subject || "Test from RemoteIQ",
                text: body || "This is a test email from RemoteIQ.",
            });
            return { ok: true, result: "Test email sent" };
        } catch (e: any) {
            return { ok: false, result: this.formatMailError(e) };
        }
    }

    async testImap(purpose: EmailPurpose) {
        const all = await this.repo.getAllRaw();
        const r = all[purpose];
        if (!r?.imap_host || !r?.imap_port) return { ok: false, result: "IMAP not configured" };
        return this.probePort(r.imap_host, r.imap_port, r.imap_use_ssl);
    }

    async testPop(purpose: EmailPurpose) {
        const all = await this.repo.getAllRaw();
        const r = all[purpose];
        if (!r?.pop_host || !r?.pop_port) return { ok: false, result: "POP not configured" };
        return this.probePort(r.pop_host, r.pop_port, r.pop_use_ssl);
    }

    private async probePort(host: string, port: number, ssl: boolean) {
        return new Promise<{ ok: boolean; result?: string }>((resolve) => {
            const ok = () => resolve({ ok: true, result: "Connected" });
            const err = (e?: any) => resolve({ ok: false, result: e?.message || "Connection failed" });
            if (ssl) {
                const s = tls.connect({ host, port, servername: host, rejectUnauthorized: TLS_REJECT_UNAUTH }, ok);
                s.setTimeout(6000, () => {
                    s.destroy();
                    err(new Error("Timeout"));
                });
                s.on("error", err);
            } else {
                const s = net.createConnection({ host, port }, ok);
                s.setTimeout(6000, () => {
                    s.destroy();
                    err(new Error("Timeout"));
                });
                s.on("error", err);
            }
        });
    }

    /** DNS: Check DKIM TXT value for selector._domainkey.domain */
    async verifyDkimDns(domain: string, selector: string) {
        const name = `${selector}._domainkey.${domain}`.replace(/\.+/g, ".").toLowerCase();
        try {
            const txt = await dns.resolveTxt(name);
            const flat = txt.map((arr) => arr.join("")).join("");
            return { ok: true, name, found: !!flat, value: flat || undefined };
        } catch (e: any) {
            return { ok: false, name, error: e?.message || String(e) };
        }
    }

    /** Quick SMTP health probe using verify() */
    async smtpHealth(purpose: EmailPurpose) {
        const all = await this.repo.getAllRaw();
        const r = all[purpose];
        const { opts, message } = await this.buildTransport(r);
        if (!opts) return { ok: false, result: message || "not configured" };
        try {
            const t = this.nodemailerTransport(opts);
            await t.verify();
            return { ok: true, result: "ok" };
        } catch (e: any) {
            return { ok: false, result: this.formatMailError(e) };
        }
    }

    /** Quick IMAP health (socket probe) */
    async imapHealth(purpose: EmailPurpose) {
        const all = await this.repo.getAllRaw();
        const r = all[purpose];
        if (!r?.imap_host || !r?.imap_port || !r?.imap_username || !r?.imap_password) {
            return { ok: false, result: "not configured" };
        }
        return this.probePort(r.imap_host, r.imap_port, r.imap_use_ssl);
    }
}
