"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledInput, LabeledNumber, CheckToggle, LabeledSelect } from "../helpers";
import { Separator } from "@/components/ui/separator";

export type ComplianceTabProps = {
    push: (t: any) => void;
};

export default function ComplianceTab({ push }: ComplianceTabProps) {

    return (
        <TabsContent value="compliance">
            <Card>
                <CardHeader>
                    <CardTitle>Compliance & Data Governance</CardTitle>
                    <CardDescription>
                        Configure data residency, retention rules, and tools for legal compliance.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <LabeledSelect
                            label="Data Residency Preference"
                            value="us-east-1"
                            onChange={() => { }}
                            options={[
                                { value: "us-east-1", label: "US East (N. Virginia)" },
                                { value: "eu-central-1", label: "EU (Frankfurt)" },
                                { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
                            ]}
                        />
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-sm font-medium mb-2">Data Retention Rules</h3>
                        <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-md">
                            <LabeledNumber label="Audit Logs (days)" value={365} onChange={() => { }} />
                            <LabeledNumber label="Inactive Devices (days)" value={90} onChange={() => { }} />
                            <LabeledNumber label="Resolved Alerts (days)" value={180} onChange={() => { }} />
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-sm font-medium mb-2">Privacy & PII</h3>
                        <div className="space-y-3 p-4 border rounded-md">
                            <CheckToggle label="Enable PII redaction in logs" checked={true} onChange={() => { }} />
                            <CheckToggle label="Log user consent for tracking" checked={true} onChange={() => { }} />
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-sm font-medium mb-2">Legal & Export</h3>
                        <div className="space-y-3 p-4 border rounded-md">
                            <LabeledInput label="Legal Hold Email" value="legal@example.com" onChange={() => { }} />
                            <Button variant="outline">Export All User Data (JSON)</Button>
                        </div>
                    </div>


                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Compliance settings saved", kind: "success" })}>
                            Save Compliance Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

