import * as React from "react";

type Handlers = {
    onSave?: () => void;
    onCancel?: () => void;
};

/** ⌘/Ctrl+S = save, Esc = cancel (if handlers provided) */
export function useAccountShortcuts({ onSave, onCancel }: Handlers) {
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
            if (isSave && onSave) {
                e.preventDefault();
                onSave();
                return;
            }
            if (e.key === "Escape" && onCancel) {
                e.preventDefault();
                onCancel();
                return;
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onSave, onCancel]);
}
