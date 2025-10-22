"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";

export type CustomFieldsTabProps = {
    push: (t: any) => void;
};

export default function CustomFieldsTab({ push }: CustomFieldsTabProps) {
    const customFields = [
        { id: 'cf1', name: 'Asset Tag', type: 'Text', appliesTo: 'Devices', required: true },
        { id: 'cf2', name: 'Department', type: 'Dropdown', appliesTo: 'Users', required: false },
        { id: 'cf3', name: 'Warranty Expiry', type: 'Date', appliesTo: 'Devices', required: false },
    ];

    return (
        <TabsContent value="custom_fields">
            <Card>
                <CardHeader>
                    <CardTitle>Custom Fields & Forms</CardTitle>
                    <CardDescription>
                        Define custom attributes for users, devices, and other records.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="success"><Plus className="mr-2 h-4 w-4" /> New Custom Field</Button>
                    </div>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-4 px-2">Field Name</div>
                            <div className="col-span-2 px-2">Type</div>
                            <div className="col-span-3 px-2">Applies To</div>
                            <div className="col-span-3 px-2 text-right">Actions</div>
                        </div>
                        {customFields.map(field => (
                            <div key={field.id} className="grid grid-cols-12 items-center border-b p-2 last:border-b-0 text-sm">
                                <div className="col-span-4 px-2 font-medium">{field.name} {field.required && <span className="text-destructive">*</span>}</div>
                                <div className="col-span-2 px-2 text-muted-foreground">{field.type}</div>
                                <div className="col-span-3 px-2 text-muted-foreground">{field.appliesTo}</div>
                                <div className="col-span-3 px-2 flex items-center justify-end gap-2">
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
