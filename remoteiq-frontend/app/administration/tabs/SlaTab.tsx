"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledInput, LabeledNumber, LabeledSelect } from "../helpers";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

export type SlaTabProps = {
    push: (t: any) => void;
};

export default function SlaTab({ push }: SlaTabProps) {

    return (
        <TabsContent value="sla">
            <Card>
                <CardHeader>
                    <CardTitle>SLA & Escalations</CardTitle>
                    <CardDescription>
                        Define response/resolve targets, business hours, and escalation chains.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-sm font-medium mb-2">Business Hours</h3>
                        <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-md">
                            <LabeledSelect
                                label="Time Zone"
                                value="est"
                                onChange={() => { }}
                                options={[{ value: "est", label: "America/New_York (EST)" }, { value: "pst", label: "America/Los_Angeles (PST)" }]}
                            />
                            <LabeledInput label="Business Hours (Start)" type="time" value="09:00" onChange={() => { }} />
                            <LabeledInput label="Business Hours (End)" type="time" value="17:00" onChange={() => { }} />
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="text-sm font-medium mb-2">SLA Policies</h3>
                        <div className="flex justify-end mb-2">
                            <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Policy</Button>
                        </div>
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">High Priority Tickets</CardTitle>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-4">
                                    <LabeledNumber label="First Response Time (minutes)" value={15} onChange={() => { }} />
                                    <LabeledNumber label="Resolution Time (hours)" value={4} onChange={() => { }} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Medium Priority Tickets</CardTitle>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-4">
                                    <LabeledNumber label="First Response Time (minutes)" value={60} onChange={() => { }} />
                                    <LabeledNumber label="Resolution Time (hours)" value={8} onChange={() => { }} />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "SLA settings saved", kind: "success" })}>
                            Save SLA Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
