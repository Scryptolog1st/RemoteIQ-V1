"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Bug } from "lucide-react";

export type FeatureFlagsTabProps = {
    push: (t: any) => void;
};

function FlagRow({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
    return (
        <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                <span className="text-sm">{label}</span>
            </div>
            <Switch defaultChecked={defaultChecked} />
        </div>
    );
}

export default function FeatureFlagsTab({ push }: FeatureFlagsTabProps) {
    return (
        <TabsContent value="flags">
            <Card>
                <CardHeader>
                    <CardTitle>Feature Flags</CardTitle>
                    <CardDescription>Toggle preview features for your organization.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <FlagRow label="New device grid" defaultChecked />
                    <FlagRow label="Faster search pipeline" />
                    <FlagRow label="Agent live stream" />
                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Flags updated", kind: "success" })}>
                            Save flags
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
