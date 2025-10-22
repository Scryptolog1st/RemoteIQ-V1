"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";

export type SessionsTabProps = {
    push: (t: any) => void;
};

export default function SessionsTab({ push }: SessionsTabProps) {
    const sessions = [
        { id: 'ses1', user: 'alex@example.com', ip: '73.184.10.22', device: 'Chrome on Windows', lastActive: '2 minutes ago' },
        { id: 'ses2', user: 'jamie@example.com', ip: '108.22.4.15', device: 'Safari on macOS', lastActive: '1 hour ago' },
        { id: 'ses3', user: 'alex@example.com', ip: '73.184.10.22', device: 'RemoteIQ iOS App', lastActive: '3 hours ago' },
    ];

    return (
        <TabsContent value="sessions">
            <Card>
                <CardHeader>
                    <CardTitle>Session Management</CardTitle>
                    <CardDescription>
                        View and terminate active user sessions across the platform.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="destructive">Terminate All Sessions</Button>
                    </div>
                    <div className="rounded-md border">
                        {sessions.map(session => (
                            <div key={session.id} className="grid grid-cols-12 items-center border-b p-3 last:border-b-0 text-sm">
                                <div className="col-span-3 font-medium">{session.user}</div>
                                <div className="col-span-3 text-muted-foreground">{session.ip}</div>
                                <div className="col-span-3 text-muted-foreground">{session.device}</div>
                                <div className="col-span-2 text-muted-foreground">{session.lastActive}</div>
                                <div className="col-span-1 text-right">
                                    <Button variant="outline" size="sm">Terminate</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
