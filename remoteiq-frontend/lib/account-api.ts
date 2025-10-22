/* lib/account-api.ts — Enhanced mocked account API */

function sleep(ms = 500) { return new Promise((res) => setTimeout(res, ms)); }
function rnd(n = 900000) { return (100000 + Math.floor(Math.random() * n)).toString(); }

/* ===== Profile ===== */
export type Profile = {
  firstName: string; lastName: string; username: string;
  email: string; billingEmail?: string; phone?: string;
  timezone: string; locale: string; avatarUrl?: string;
};

export async function getProfile(): Promise<Profile> {
  await sleep();
  return {
    firstName: "Alex", lastName: "Morgan", username: "alexm",
    email: "alex@example.com", billingEmail: "billing@example.com",
    phone: "", timezone: "UTC", locale: "en-US", avatarUrl: "",
  };
}

export async function checkUsername(username: string): Promise<{ available: boolean }> {
  await sleep(400);
  const taken = new Set(["admin", "root", "support"]);
  const base = username.toLowerCase().replace(/\d+$/g, "");
  return { available: !(taken.has(username.toLowerCase()) || taken.has(base)) };
}
export const checkUsernameAvailable = checkUsername;

export async function updateProfile(payload: Partial<Profile>): Promise<{ ok: true } & Partial<Profile>> {
  await sleep(600);
  return { ok: true, ...payload };
}

/* ===== Security ===== */
export type Security = { twoFaEnabled: boolean; autoRevokeSessions: boolean; };
export async function getSecurity(): Promise<Security> { await sleep(); return { twoFaEnabled: false, autoRevokeSessions: true }; }
export async function updateSecurity(_payload: Partial<Security & { newPassword?: string }>) { await sleep(600); return { ok: true }; }
export async function reauthCheck() { await sleep(400); return { ok: true }; }
export async function registerPasskey() { await sleep(700); return { ok: true, credentialId: `cred_${rnd()}` }; }

/* ===== Sessions ===== */
export type Session = { id: string; device: string; ip: string; lastActive: string; current: boolean; city?: string; isp?: string; trusted?: boolean; label?: string; };
export async function getSessions(): Promise<Session[]> {
  await sleep();
  return [
    { id: "s1", device: "Chrome on Windows", ip: "73.184.10.22", lastActive: "2 minutes ago", current: true, city: "Boston, MA", isp: "Comcast", trusted: true, label: "Work PC" },
    { id: "s2", device: "Safari on iPhone", ip: "73.184.10.22", lastActive: "2 days ago", current: false, city: "Boston, MA", isp: "Comcast", trusted: false },
  ];
}
export async function toggleTrustSession(id: string, trusted: boolean) { await sleep(300); return { ok: true, id, trusted }; }
export async function updateSessionLabel(id: string, label: string) { await sleep(300); return { ok: true, id, label }; }
export async function revokeSession(id: string) { await sleep(400); return { ok: true, id }; }
export async function revokeAll() { await sleep(700); return { ok: true }; }

/* ===== Notifications ===== */
export type Notifications = {
  email: boolean; push: boolean; product: boolean;
  digest: "never" | "daily" | "weekly" | "monthly";
  quiet: { enabled: boolean; start: string; end: string };
  products: string[];
};
export async function getNotifications(): Promise<Notifications> {
  await sleep();
  return { email: true, push: false, product: true, digest: "daily", quiet: { enabled: false, start: "22:00", end: "07:00" }, products: ["RMM Alerts", "Billing"] };
}
export async function updateNotifications(_payload: Partial<Notifications>) { await sleep(600); return { ok: true }; }
export async function sendTestEmail() { await sleep(500); return { ok: true, id: `msg_${rnd()}` }; }

/* ===== Integrations ===== */
export type Integrations = { slackWebhook: string; webhookUrl: string; webhookSigningSecret: string; events: string[]; };
export async function getIntegrations(): Promise<Integrations> {
  await sleep();
  return { slackWebhook: "", webhookUrl: "", webhookSigningSecret: "", events: ["Tickets", "Alerts"] };
}
export async function updateIntegrations(_payload: Partial<Integrations>) { await sleep(600); return { ok: true }; }
export async function testSlackWebhook(_url: string) { await sleep(500); return { ok: true, status: 200, ms: 153 }; }
export async function testGenericWebhook(_url: string) { await sleep(500); return { ok: true, status: 202, ms: 211 }; }
export async function rotateSigningSecret() { await sleep(500); return { secret: `whsec_${rnd(90000000)}` }; }
export async function previewSignature(body: string, secret: string) {
  await sleep(200);
  // mock HMAC preview (NOT real crypto)
  const mock = btoa(`${secret}:${body}`).slice(0, 24);
  return { header: `X-RemoteIQ-Signature: v1=${mock}` };
}

/* ===== Billing ===== */
export type BillingProfile = { company: string; addr1: string; addr2?: string; city: string; country: string; cardLast4: string; taxId?: string; };
export async function getBillingProfile(): Promise<BillingProfile> {
  await sleep();
  return { company: "Acme MSP", addr1: "100 Main St", addr2: "", city: "Springfield", country: "US", cardLast4: "4242", taxId: "" };
}
export async function updateBillingProfile(_payload: Partial<BillingProfile>) { await sleep(600); return { ok: true }; }
export type Invoice = { id: string; date: string; total: number; currency: string; status: string };
export async function listInvoices(): Promise<Invoice[]> {
  await sleep();
  return [
    { id: "inv_1003", date: "2025-10-01", total: 199.00, currency: "USD", status: "Paid" },
    { id: "inv_1002", date: "2025-09-01", total: 199.00, currency: "USD", status: "Paid" },
    { id: "inv_1001", date: "2025-08-01", total: 199.00, currency: "USD", status: "Paid" },
  ];
}
export async function estimateNextInvoice() {
  await sleep(300);
  return { estimate: 219.00, currency: "USD", note: "Proration for +2 seats mid-cycle." };
}

/* ===== API Keys ===== */
export type ApiKey = { id: string; label: string; lastUsed?: string; scopes?: string[]; expiresAt?: string; };
export async function listApiKeys(): Promise<ApiKey[]> {
  await sleep();
  return [{ id: "rk_live_xxx123", label: "Production server", lastUsed: "3 hours ago", scopes: ["read", "write"], expiresAt: "" }];
}
export async function createApiKey(label: string, scopes: string[], expiresIn: "never" | "30d" | "90d", ipAllowlist?: string): Promise<ApiKey> {
  await sleep(500);
  const id = `rk_live_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = expiresIn === "never" ? "" : new Date(Date.now() + (expiresIn === "30d" ? 30 : 90) * 24 * 3600 * 1000).toISOString();
  void ipAllowlist;
  return { id, label, scopes, expiresAt };
}
export async function revokeApiKey(id: string) { await sleep(400); return { ok: true, id }; }
export async function regenerateApiKey(id: string) { await sleep(500); return { oldId: id, newKey: `rk_live_${Math.random().toString(36).slice(2, 10)}` }; }
export async function keyUsage(id: string) {
  await sleep(250);
  // mock 7-day request counts
  return { id, last7: Array.from({ length: 7 }, (_, i) => ({ d: i, c: Math.floor(Math.random() * 120) })) };
}

/* ===== Audit ===== */
export type AuditEvent = { id: string; at: string; action: string; details: string };
export async function getAuditEvents(section: string): Promise<AuditEvent[]> {
  await sleep(200);
  const now = Date.now();
  const sample = [
    { action: "Saved", details: `Updated ${section} settings` },
    { action: "Viewed", details: `Opened ${section} tab` },
  ];
  return sample.map((s, i) => ({ id: `${section}_${i}`, at: new Date(now - i * 3600_000).toISOString(), ...s }));
}
