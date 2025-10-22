"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledSelect } from "../helpers";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, History } from "lucide-react";
import { cn } from "@/lib/utils";


export type ImportExportTabProps = {
    push: (t: any) => void;
};

export default function ImportExportTab({ push }: ImportExportTabProps) {
    const jobHistory = [
        { id: 'jh1', type: 'Import', entity: 'Users', status: 'Completed', at: '2025-10-10 14:30' },
        { id: 'jh2', type: 'Export', entity: 'Devices', status: 'Completed', at: '2025-10-09 11:00' },
        { id: 'jh3', type: 'Import', entity: 'Users', status: 'Failed', at: '2025-10-08 16:00' },
    ];

    return (
        <TabsContent value="import_export">
            <Card>
                <CardHeader>
                    <CardTitle>Import / Export</CardTitle>
                    <CardDescription>
                        Bulk import and export data using CSV files.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Import Data</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <LabeledSelect
                                    label="Select data type to import"
                                    value="users"
                                    onChange={() => { }}
                                    options={[
                                        { value: "users", label: "Users" },
                                        { value: "devices", label: "Devices" },
                                        { value: "customers", label: "Customers" },
                                    ]}
                                />
                                <Button className="w-full" variant="outline">Upload CSV File</Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Export Data</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <LabeledSelect
                                    label="Select data type to export"
                                    value="devices"
                                    onChange={() => { }}
                                    options={[
                                        { value: "users", label: "Users" },
                                        { value: "devices", label: "Devices (with custom fields)" },
                                        { value: "audit_logs", label: "Audit Logs" },
                                    ]}
                                />
                                <Button className="w-full">Export Data</Button>
                            </CardContent>
                        </Card>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><History className="h-4 w-4" /> Job History</h3>
                        <div className="rounded-md border">
                            {jobHistory.map(job => (
                                <div key={job.id} className="grid grid-cols-4 items-center border-b p-2 last:border-b-0 text-sm">
                                    <div className="font-medium">{job.type}: {job.entity}</div>
                                    <div className={cn("font-semibold", job.status === 'Failed' ? 'text-destructive' : 'text-green-600')}>{job.status}</div>
                                    <div className="text-muted-foreground col-span-2 text-right">{job.at}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

