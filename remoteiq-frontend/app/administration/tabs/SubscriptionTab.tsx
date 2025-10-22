"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledInput } from "../helpers";
import { ToastFn, SubscriptionInfo } from "../types";

interface SubscriptionTabProps {
    push: ToastFn;
}

export default function SubscriptionTab({ push }: SubscriptionTabProps) {
    const [subscription, setSubscription] = React.useState<SubscriptionInfo>({
        plan: "Enterprise",
        seatsUsed: 87,
        seatsTotal: 100,
        renewalDate: "2026-01-15",
        licenseKey: "RK-ENT-XXXX-XXXX-XXXX-XXXX"
    });

    return (
        <TabsContent value="subscription" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Subscription & Licensing</CardTitle>
                    <CardDescription>Manage your plan, seat usage, and license keys.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-md border p-4 grid md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-muted-foreground">Current Plan</div>
                            <div className="text-xl font-bold">{subscription.plan}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Renewal Date</div>
                            <div className="text-xl font-bold">{subscription.renewalDate}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Seats</div>
                            <div className="text-xl font-bold">{subscription.seatsUsed} / {subscription.seatsTotal}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button>Manage Billing</Button>
                            <Button variant="outline">Add Seats</Button>
                        </div>
                    </div>
                    <LabeledInput label="License Key (for on-prem agents)" value={subscription.licenseKey} onChange={v => setSubscription(s => ({ ...s, licenseKey: v }))} />
                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Subscription settings saved", kind: "success" })}>
                            Save License
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
