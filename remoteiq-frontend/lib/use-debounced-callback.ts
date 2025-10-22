// Simple, typed debounce hook for stable callbacks
import * as React from "react";

export function useDebouncedCallback<T extends (...args: any[]) => void>(
    fn: T,
    delay = 500
) {
    const fnRef = React.useRef(fn);
    fnRef.current = fn;

    const timer = React.useRef<number | null>(null);

    const debounced = React.useCallback((...args: Parameters<T>) => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            fnRef.current(...args);
        }, delay) as unknown as number;
    }, [delay]);

    React.useEffect(() => () => {
        if (timer.current) window.clearTimeout(timer.current);
    }, []);

    return debounced as T;
}
