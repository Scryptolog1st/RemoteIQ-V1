//lib\debug.ts

let _enabled = false;

// Read once; you can toggle at runtime via localStorage + reload
if (typeof window !== "undefined") {
    try {
        _enabled = !!window.localStorage.getItem("remoteiq.debug");
    } catch {
        _enabled = false;
    }
}

export function setDebugEnabled(v: boolean) {
    _enabled = v;
}

export function isDebugEnabled() {
    return _enabled;
}

export function dlog(...args: any[]) {
    if (_enabled) console.debug("[RemoteIQ]", ...args);
}

export function dgroup(label: string) {
    if (_enabled) console.groupCollapsed(`[RemoteIQ] ${label}`);
}

export function dgroupEnd() {
    if (_enabled) console.groupEnd();
}
