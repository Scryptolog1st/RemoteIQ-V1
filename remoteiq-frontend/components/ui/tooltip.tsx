//components\ui\tooltip.tsx

"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Expose both a named and a default export for TooltipProvider
 * so users can `import { TooltipProvider }` or `import TooltipProvider`.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
const TooltipProviderDefault = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
            "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
            "data-[state=delayed-open]:data-[side=top]:animate-in",
            "data-[state=delayed-open]:data-[side=bottom]:animate-in",
            "data-[state=delayed-open]:data-[side=left]:animate-in",
            "data-[state=delayed-open]:data-[side=right]:animate-in",
            className
        )}
        {...props}
    />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export default TooltipProviderDefault;
