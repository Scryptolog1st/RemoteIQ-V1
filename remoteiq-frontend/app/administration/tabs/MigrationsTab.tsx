"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";

export type MigrationsTabProps = {
    push: (t: any) => void;
};

export default function MigrationsTab({ push }: MigrationsTabProps) {
    const migrations = [
        { id: '20251010-add-device-tags', status: 'Applied', description: 'Add tags column to devices table' },
        { id: '20251001-create-audit-table', status: 'Applied', description: 'Initial audit log schema' },
        { id: '20251015-add-user-prefs', status: 'Pending', description: 'Add user preferences JSON column' },
    ];

    return (
        <TabsContent value="migrations">
            <Card>
                <CardHeader>
                    <CardTitle>Data Migrations</CardTitle>
                    <CardDescription>
                        Manage and run versioned database schema migrations.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end gap-2">
                        <Button variant="outline">Dry Run Pending Migrations</Button>
                        <Button variant="destructive">Run Pending Migrations</Button>
                    </div>
                    <div className="rounded-md border">
                        {migrations.map(m => (
                            <div key={m.id} className="flex items-center gap-4 border-b p-3 last:border-b-0">
                                {m.status === 'Applied' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {m.status === 'Pending' && <Loader className="h-5 w-5 text-amber-500 animate-spin" />}
                                {m.status === 'Failed' && <AlertCircle className="h-5 w-5 text-destructive" />}
                                <div>
                                    <div className="font-mono text-sm">{m.id}</div>
                                    <div className="text-xs text-muted-foreground">{m.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
