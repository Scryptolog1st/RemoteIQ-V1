// Persist / hydrate form drafts per-tab in sessionStorage
export function saveDraft<T>(key: string, data: T) {
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
    } catch { }
}
export function loadDraft<T>(key: string): T | null {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}
export function clearDraft(key: string) {
    try {
        sessionStorage.removeItem(key);
    } catch { }
}
