//lib\view-state.ts

import { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";

type TableState = {
    s: SortingState;
    f: ColumnFiltersState;
    v: VisibilityState;
};

export function encodeTableState(state: TableState) {
    // micro-encode: JSON → base64 (swap +/= for URL safe)
    const json = JSON.stringify(state);
    const b64 = typeof window !== "undefined" ? window.btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeTableState(token: string | null): TableState | null {
    if (!token) return null;
    try {
        const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
        const json = typeof window !== "undefined" ? decodeURIComponent(escape(window.atob(padded))) : Buffer.from(padded, "base64").toString();
        const obj = JSON.parse(json);
        if (!obj || typeof obj !== "object") return null;
        return obj as TableState;
    } catch {
        return null;
    }
}
