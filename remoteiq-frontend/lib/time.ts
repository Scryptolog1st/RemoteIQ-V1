// lib/time.ts
// US-style: MM/DD/YYYY - H:MM AM/PM (local time)
const usFmt = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
});

export function formatUsDateTime(iso?: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    // Replace the comma Intl adds with " -"
    return usFmt.format(d).replace(",", " -");
}
