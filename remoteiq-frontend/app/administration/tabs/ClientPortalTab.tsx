"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { CheckToggle } from "../helpers";
import { ToastFn, ClientPortalSettings } from "../types";

interface ClientPortalTabProps {
    push: ToastFn;
}

export default function ClientPortalTab({ push }: ClientPortalTabProps) {
    const [clientPortal, setClientPortal] = React.useState<ClientPortalSettings>({
        enabledModules: ['dashboard', 'tickets', 'devices'],
        showSla: true,
        contactMethods: ['portal', 'email']
    });

    function toggleClientPortalModule(module: ClientPortalSettings['enabledModules'][0]) {
        setClientPortal(prev => {
            const modules = prev.enabledModules.includes(module)
                ? prev.enabledModules.filter(m => m !== module)
                : [...prev.enabledModules, module];
            return { ...prev, enabledModules: modules };
        });
    }

    function toggleClientPortalContact(method: ClientPortalSettings['contactMethods'][0]) {
        setClientPortal(prev => {
            const methods = prev.contactMethods.includes(method)
                ? prev.contactMethods.filter(m => m !== method)
                : [...prev.contactMethods, method];
            return { ...prev, contactMethods: methods };
        });
    }

    return (
        <TabsContent value="client_portal" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Client Portal Settings</CardTitle>
                    <CardDescription>Configure what your clients can see and do in their portal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Enabled Modules</Label>
                            <CheckToggle label="Dashboard" checked={clientPortal.enabledModules.includes('dashboard')} onChange={() => toggleClientPortalModule('dashboard')} />
                            <CheckToggle label="Tickets" checked={clientPortal.enabledModules.includes('tickets')} onChange={() => toggleClientPortalModule('tickets')} />
                            <CheckToggle label="Devices" checked={clientPortal.enabledModules.includes('devices')} onChange={() => toggleClientPortalModule('devices')} />
                            <CheckToggle label="Invoices & Billing" checked={clientPortal.enabledModules.includes('invoices')} onChange={() => toggleClientPortalModule('invoices')} />
                            <CheckToggle label="Reports" checked={clientPortal.enabledModules.includes('reports')} onChange={() => toggleClientPortalModule('reports')} />
                        </div>
                        <div className="space-y-2">
                            <Label>Other Settings</Label>
                            <CheckToggle label="Show SLA Information" checked={clientPortal.showSla} onChange={v => setClientPortal(cp => ({ ...cp, showSla: v }))} />
                            <Label className="mt-4 block">Allowed Contact Methods</Label>
                            <CheckToggle label="Portal Tickets" checked={clientPortal.contactMethods.includes('portal')} onChange={() => toggleClientPortalContact('portal')} />
                            <CheckToggle label="Email" checked={clientPortal.contactMethods.includes('email')} onChange={() => toggleClientPortalContact('email')} />
                            <CheckToggle label="Phone" checked={clientPortal.contactMethods.includes('phone')} onChange={() => toggleClientPortalContact('phone')} />
                        </div>
                    </div>
                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Client portal settings saved", kind: "success" })}>
                            Save Portal Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
