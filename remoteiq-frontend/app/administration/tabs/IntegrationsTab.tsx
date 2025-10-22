"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Plug, Slack } from "lucide-react";
import { ToastFn, Integration } from "../types";

interface IntegrationsTabProps {
    push: ToastFn;
}

export default function IntegrationsTab({ push }: IntegrationsTabProps) {
    const [integrations, setIntegrations] = React.useState<Integration[]>([
        { id: 'slack', name: 'Slack', connected: true },
        { id: 'teams', name: 'Microsoft Teams', connected: false },
        { id: 'jira', name: 'Jira', connected: false },
        { id: 'servicenow', name: 'ServiceNow', connected: true },
        { id: 'zendesk', name: 'Zendesk', connected: false },
    ]);

    const toggleIntegration = (id: Integration['id']) => {
        setIntegrations(prev =>
            prev.map(integ =>
                integ.id === id ? { ...integ, connected: !integ.connected } : integ
            )
        );
        const integName = integrations.find(i => i.id === id)?.name;
        const isConnecting = !integrations.find(i => i.id === id)?.connected;
        push({
            title: `${integName} ${isConnecting ? 'Connected' : 'Disconnected'}`,
            kind: isConnecting ? "success" : "default"
        });
    };

    return (
        <TabsContent value="integrations" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Integrations</CardTitle>
                    <CardDescription>Connect RemoteIQ to other services like Slack, Jira, and ServiceNow.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {integrations.map(integ => (
                            <Card key={integ.id}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">{integ.name}</CardTitle>
                                    {integ.id === 'slack' ? <Slack className="h-4 w-4 text-muted-foreground" /> : <Plug className="h-4 w-4 text-muted-foreground" />}
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xs text-muted-foreground mb-4">{integ.connected ? 'Connected' : 'Not connected'}</div>
                                    <Button
                                        variant={integ.connected ? 'destructive' : 'default'}
                                        className="w-full"
                                        onClick={() => toggleIntegration(integ.id)}
                                    >
                                        {integ.connected ? 'Disconnect' : 'Connect'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
