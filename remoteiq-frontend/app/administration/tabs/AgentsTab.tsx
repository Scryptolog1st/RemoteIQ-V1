"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledInput, LabeledNumber, CheckToggle, LabeledTextarea } from "../helpers";
import { Separator } from "@/components/ui/separator";
import { Download, RefreshCw } from "lucide-react";

export type AgentsTabProps = {
    push: (t: any) => void;
};

export default function AgentsTab({ push }: AgentsTabProps) {

    return (
        <TabsContent value="agents">
            <Card>
                <CardHeader>
                    <CardTitle>Agents & Endpoints</CardTitle>
                    <CardDescription>
                        Manage agent installers, default configurations, and enrollment tokens.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-sm font-medium mb-2">Agent Installers</h3>
                        <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-md">
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Windows (.msi)</Button>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> macOS (.pkg)</Button>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Linux (.deb)</Button>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-sm font-medium mb-2">Enrollment Tokens</h3>
                        <div className="flex items-center gap-4 p-4 border rounded-md">
                            <LabeledInput label="Default Token (expires in 30 days)" value="ENROLL-XXXXXXXXXXXX" onChange={() => { }} />
                            <Button variant="secondary" size="icon"><RefreshCw className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-sm font-medium mb-2">Default Agent Configuration</h3>
                        <div className="grid md:grid-cols-2 gap-6 p-4 border rounded-md">
                            <LabeledNumber label="Heartbeat Interval (seconds)" value={60} onChange={() => { }} />
                            <CheckToggle label="Enable Automatic Updates" checked={true} onChange={() => { }} />
                            <LabeledTextarea label="Default Maintenance Scripts (run on install)" value={"# Example script\necho 'Hello from RemoteIQ!'"} onChange={() => { }} />
                        </div>
                    </div>

                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Agent settings saved", kind: "success" })}>
                            Save Agent Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

