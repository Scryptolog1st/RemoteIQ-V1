// components/ambient-tooltips.tsx
"use client";

import * as React from "react";

/**
 * AmbientTooltips
 * ---------------
 * Shows a small tooltip near any element with [data-tooltip].
 * No external deps. Theme-aware via CSS variables (see globals.css).
 *
 * Usage:
 *   <button data-tooltip="Copies the device ID">Copy</button>
 */
export default function AmbientTooltips() {
    const tooltipRef = React.useRef<HTMLDivElement | null>(null);
    const hideTimer = React.useRef<number | null>(null);

    React.useEffect(() => {
        // Create tooltip node once
        const tooltip = document.createElement("div");
        tooltip.className = "riq-tooltip hidden";
        document.body.appendChild(tooltip);
        tooltipRef.current = tooltip;

        // Walk up DOM to find any element with data-tooltip
        const getTarget = (node: EventTarget | null): HTMLElement | null => {
            let el = node as HTMLElement | null;
            while (el) {
                if (el instanceof HTMLElement && typeof el.dataset?.tooltip === "string") {
                    return el;
                }
                el = el.parentElement;
            }
            return null;
        };

        const show = (e: MouseEvent) => {
            const el = getTarget(e.target);
            if (!el || !tooltipRef.current) return;
            const msg = el.getAttribute("data-tooltip");
            if (!msg) return;

            if (hideTimer.current) {
                window.clearTimeout(hideTimer.current);
                hideTimer.current = null;
            }

            const tt = tooltipRef.current;
            tt.textContent = msg;
            tt.classList.remove("hidden");

            // Position near the element
            const rect = el.getBoundingClientRect();

            // Temporarily set visibility to measure size accurately
            tt.style.top = `-9999px`;
            tt.style.left = `-9999px`;
            const ttRect = tt.getBoundingClientRect();

            // Prefer below; fallback above if overflow
            let top = rect.bottom + 8 + window.scrollY;
            let left =
                rect.left +
                Math.max(0, (rect.width - ttRect.width) / 2) +
                window.scrollX;

            // Keep inside viewport horizontally
            left = Math.max(
                8 + window.scrollX,
                Math.min(left, window.scrollX + window.innerWidth - ttRect.width - 8)
            );

            // If bottom would overflow, place above
            if (top + ttRect.height > window.scrollY + window.innerHeight) {
                top = rect.top - ttRect.height - 8 + window.scrollY;
            }

            tt.style.top = `${top}px`;
            tt.style.left = `${left}px`;
        };

        const hide = () => {
            if (!tooltipRef.current) return;
            if (hideTimer.current) window.clearTimeout(hideTimer.current);
            hideTimer.current = window.setTimeout(() => {
                tooltipRef.current?.classList.add("hidden");
            }, 60);
        };

        const immediateHide = () => {
            tooltipRef.current?.classList.add("hidden");
        };

        document.addEventListener("pointerenter", show, true);
        document.addEventListener("pointermove", show, true);
        document.addEventListener("pointerleave", hide, true);
        window.addEventListener("scroll", immediateHide, true);
        window.addEventListener("resize", immediateHide);

        return () => {
            document.removeEventListener("pointerenter", show, true);
            document.removeEventListener("pointermove", show, true);
            document.removeEventListener("pointerleave", hide, true);
            window.removeEventListener("scroll", immediateHide, true);
            window.removeEventListener("resize", immediateHide);
            tooltip.remove();
            tooltipRef.current = null;
        };
    }, []);

    return null;
}
