"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Eye, EyeOff } from "lucide-react";

export type SecretsTabProps = {
    push: (t: any) => void;
};

export default function SecretsTab({ push }: SecretsTabProps) {
    const [revealed, setRevealed] = React.useState<string[]>([]);
    const toggleReveal = (id: string) => {
        setRevealed(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    const secrets = [
        { id: 'sec1', name: 'SLACK_API_TOKEN', updated: '2 months ago' },
        { id: 'sec2', name: 'TWILIO_AUTH_SECRET', updated: '1 week ago' },
    ];

    return (
        <TabsContent value="secrets">
            <Card>
                <CardHeader>
                    <CardTitle>Secrets & Environment</CardTitle>
                    <CardDescription>
                        Manage encrypted organization secrets like API tokens and webhook credentials.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="success"><Plus className="mr-2 h-4 w-4" /> New Secret</Button>
                    </div>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-5 px-2">Secret Name</div>
                            <div className="col-span-4 px-2">Value</div>
                            <div className="col-span-3 px-2 text-right">Actions</div>
                        </div>
                        {secrets.map(sec => (
                            <div key={sec.id} className="grid grid-cols-12 items-center border-b p-2 last:border-b-0 text-sm">
                                <div className="col-span-5 px-2 font-mono">{sec.name}</div>
                                <div className="col-span-4 px-2 font-mono text-muted-foreground">
                                    {revealed.includes(sec.id) ? 'sk_live_xxxxxxxxxxxx' : '••••••••••••••••••••'}
                                </div>
                                <div className="col-span-3 px-2 flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => toggleReveal(sec.id)}>
                                        {revealed.includes(sec.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="outline" size="sm">Edit</Button>
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
