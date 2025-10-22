"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Play, Pause } from "lucide-react";

export type WorkflowsTabProps = {
    push: (t: any) => void;
};

export default function WorkflowsTab({ push }: WorkflowsTabProps) {
    const workflows = [
        { id: 'wf1', name: 'Critical Alert -> Create Ticket', trigger: 'Alert Fired', status: 'active' },
        { id: 'wf2', name: 'New Device -> Run Audit Script', trigger: 'Device Registered', status: 'active' },
        { id: 'wf3', name: 'Patch Failure -> Notify Admins', trigger: 'Patch Install Failed', status: 'paused' },
    ];

    return (
        <TabsContent value="workflows">
            <Card>
                <CardHeader>
                    <CardTitle>Workflows / Automation</CardTitle>
                    <CardDescription>
                        Create no-code rules to automate actions based on triggers and conditions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="success"><Plus className="mr-2 h-4 w-4" /> New Workflow</Button>
                    </div>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-6 px-2">Name</div>
                            <div className="col-span-3 px-2">Trigger</div>
                            <div className="col-span-3 px-2 text-right">Actions</div>
                        </div>
                        {workflows.map(wf => (
                            <div key={wf.id} className="grid grid-cols-12 items-center border-b p-2 last:border-b-0 text-sm">
                                <div className="col-span-6 px-2 font-medium">{wf.name}</div>
                                <div className="col-span-3 px-2 text-muted-foreground">{wf.trigger}</div>
                                <div className="col-span-3 px-2 flex items-center justify-end gap-2">
                                    {wf.status === 'active'
                                        ? <Button variant="outline" size="sm"><Pause className="mr-2 h-4 w-4" /> Pause</Button>
                                        : <Button variant="outline" size="sm"><Play className="mr-2 h-4 w-4" /> Resume</Button>
                                    }
                                    <Button variant="destructive" size="sm">Delete</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
