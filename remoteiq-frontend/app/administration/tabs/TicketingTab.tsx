"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledInput, CheckToggle } from "../helpers";
import { Separator } from "@/components/ui/separator";

export type TicketingTabProps = {
    push: (t: any) => void;
};

export default function TicketingTab({ push }: TicketingTabProps) {

    return (
        <TabsContent value="ticketing">
            <Card>
                <CardHeader>
                    <CardTitle>Ticketing</CardTitle>
                    <CardDescription>
                        Configure queues, categories, priorities, and email-to-ticket settings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-sm font-medium mb-2">Email to Ticket</h3>
                        <div className="p-4 border rounded-md space-y-4">
                            <CheckToggle label="Enable Email-to-Ticket" checked={true} onChange={() => { }} />
                            <LabeledInput label="Ingestion Email Address" value="support@your-msp.remoteiq.com" onChange={() => { }} />
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="text-sm font-medium mb-2">Ticket Categories</h3>
                        <LabeledInput label="Categories (comma-separated)" value="Incidents, Service Requests, Networking, Hardware" onChange={() => { }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium mb-2">Ticket Priorities</h3>
                        <LabeledInput label="Priorities (comma-separated)" value="Low, Medium, High, Critical" onChange={() => { }} />
                    </div>
                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Ticketing settings saved", kind: "success" })}>
                            Save Ticketing Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
