//components\device-actions.tsx

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function DeviceActions({ deviceId }: { deviceId: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const openRunScript = React.useCallback(() => {
        // Only update the URL. The Top Bar watcher will open the modal and preselect this device.
        const sp = new URLSearchParams(searchParams);
        sp.set("device", deviceId);     // or: sp.set("runScript", deviceId)
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }, [deviceId, pathname, router, searchParams]);

    return (
        <div className="flex items-center gap-2">
            <Button size="sm" onClick={openRunScript} className="gap-2">
                <Play className="h-4 w-4" />
                Run Script
            </Button>

            {/* other device actions … */}
            {/* <Button size="sm" variant="secondary">Patch Now</Button> */}
            {/* <Button size="sm" variant="outline">Reboot</Button> */}
        </div>
    );
}
