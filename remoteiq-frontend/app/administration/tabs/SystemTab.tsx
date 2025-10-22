"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Globe, Wrench, ActivitySquare, Shield } from "lucide-react";
import { ToastFn } from "../types";
import { SettingCard } from "../helpers";

interface SystemTabProps {
    push: ToastFn;
}

export default function SystemTab({ push }: SystemTabProps) {
    const [require2FA, setRequire2FA] = React.useState<boolean>(false);
    const [twofaGraceDays, setTwofaGraceDays] = React.useState<number | "">("");

    function setNumOrEmpty(v: string, setter: (n: number | "") => void) {
        setter(v === "" ? "" : Number(v));
    }

    return (
        <TabsContent value="system" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>System Settings</CardTitle>
                    <CardDescription>Organization-wide defaults and infrastructure.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <SettingCard icon={<Globe className="h-4 w-4" />} title="Default region" desc="Choose the default backend region for agents.">
                            <Select defaultValue="us-east-1">
                                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="us-east-1">US East</SelectItem>
                                    <SelectItem value="us-west-2">US West</SelectItem>
                                    <SelectItem value="eu-central-1">EU Central</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingCard>

                        <SettingCard icon={<Wrench className="h-4 w-4" />} title="Maintenance window" desc="Weekly patching window for default policies.">
                            <Select defaultValue="sun-2am">
                                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sun-2am">Sunday 2:00 AM</SelectItem>
                                    <SelectItem value="wed-1am">Wednesday 1:00 AM</SelectItem>
                                    <SelectItem value="fri-11pm">Friday 11:00 PM</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingCard>

                        <SettingCard icon={<ActivitySquare className="h-4 w-4" />} title="Telemetry" desc="Anonymous usage metrics to improve RemoteIQ.">
                            <div className="flex items-center gap-3">
                                <Switch defaultChecked />
                                <span className="text-sm">Enabled</span>
                            </div>
                        </SettingCard>

                        <SettingCard icon={<Shield className="h-4 w-4" />} title="Two-Factor Authentication" desc="Require 2FA for all users and set an optional grace period.">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <Switch checked={require2FA} onCheckedChange={setRequire2FA} />
                                    <span className="text-sm">{require2FA ? "Required for all users" : "Optional"}</span>
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-sm">Grace period (days)</Label>
                                    <Input className="w-28" inputMode="numeric" value={twofaGraceDays} onChange={(e) => setNumOrEmpty(e.target.value, setTwofaGraceDays)} placeholder="0" disabled={!require2FA} />
                                </div>
                            </div>
                        </SettingCard>
                    </div>

                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "System settings saved", kind: "success" })}>
                            Save system settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
