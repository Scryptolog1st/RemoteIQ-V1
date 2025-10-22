"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";

export type ReportsTabProps = {
    push: (t: any) => void;
};

export default function ReportsTab({ push }: ReportsTabProps) {
    const reports = [
        { id: 'rep1', name: 'Weekly SLA Compliance', schedule: 'Every Monday at 9 AM', recipients: 'managers@example.com' },
        { id: 'rep2', name: 'Monthly Device Inventory', schedule: '1st of every month', recipients: 'assets@example.com' },
    ];
    return (
        <TabsContent value="reports">
            <Card>
                <CardHeader>
                    <CardTitle>Reports & Analytics</CardTitle>
                    <CardDescription>
                        Configure and schedule reports to be delivered via email.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="success"><Plus className="mr-2 h-4 w-4" /> New Scheduled Report</Button>
                    </div>
                    <div className="rounded-md border">
                        {reports.map(report => (
                            <div key={report.id} className="grid grid-cols-3 items-center border-b p-3 last:border-b-0">
                                <div>
                                    <div className="font-medium">{report.name}</div>
                                    <div className="text-xs text-muted-foreground">{report.schedule}</div>
                                </div>
                                <div className="text-sm text-muted-foreground truncate">{report.recipients}</div>
                                <div className="text-right">
                                    <Button variant="outline" size="sm">Edit</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
