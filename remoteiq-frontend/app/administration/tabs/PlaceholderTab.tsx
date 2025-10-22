"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";

interface PlaceholderTabProps {
    value: string;
    title: string;
}

export default function PlaceholderTab({ value, title }: PlaceholderTabProps) {
    return (
        <TabsContent value={value} className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>Configuration for {title}. This is a placeholder UI.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-48 rounded-md border-2 border-dashed">
                        <p className="text-muted-foreground">{title} UI goes here.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
