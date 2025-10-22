"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { ToastFn, NotificationRule } from "../types";
import { cn } from "@/lib/utils";

interface NotificationsTabProps {
    push: ToastFn;
}

export default function NotificationsTab({ push }: NotificationsTabProps) {
    const [notifications, setNotifications] = React.useState<NotificationRule[]>([
        { id: 'nr1', event: 'New Critical Alert', severity: 'critical', channels: ['email', 'sms', 'push'], recipients: 'on-call@example.com', enabled: true },
        { id: 'nr2', event: 'Device Offline > 30m', severity: 'error', channels: ['slack'], recipients: '#ops-alerts', enabled: true },
        { id: 'nr3', event: 'User Login from New IP', severity: 'warning', channels: ['email'], recipients: 'security@example.com', enabled: false },
    ]);

    return (
        <TabsContent value="notifications" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Define rules for routing alerts and notifications to different channels like Email, SMS, Slack, and more.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex justify-end">
                        <Button variant="success"><Plus className="mr-2 h-4 w-4" /> Add Rule</Button>
                    </div>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-4 px-2">Event</div>
                            <div className="col-span-1 px-2">Severity</div>
                            <div className="col-span-4 px-2">Channels & Recipients</div>
                            <div className="col-span-3 px-2 text-right">Actions</div>
                        </div>
                        {notifications.map((rule) => (
                            <div key={rule.id} className="grid grid-cols-12 items-center border-b p-2 text-sm last:border-b-0">
                                <div className="col-span-4 px-2 font-medium">{rule.event}</div>
                                <div className="col-span-1 px-2 capitalize">{rule.severity}</div>
                                <div className="col-span-4 px-2 text-muted-foreground">
                                    <div className="flex flex-wrap gap-1">
                                        {rule.channels.map(c => <span key={c} className="rounded border px-1.5 py-0.5 text-xs capitalize">{c}</span>)}
                                    </div>
                                    <div className="mt-1 text-xs truncate">{rule.recipients}</div>
                                </div>
                                <div className="col-span-3 px-2 flex items-center justify-end gap-2">
                                    <Switch
                                        checked={rule.enabled}
                                        onCheckedChange={(checked) =>
                                            setNotifications((prev) =>
                                                prev.map((r) => (r.id === rule.id ? { ...r, enabled: checked } : r))
                                            )
                                        }
                                    />
                                    <Button variant="outline" size="sm">Edit</Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                            setNotifications((prev) => prev.filter((r) => r.id !== rule.id));
                                            push({ title: "Rule deleted", kind: "destructive" });
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Notification settings saved", kind: "success" })}>
                            Save Notifications
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
