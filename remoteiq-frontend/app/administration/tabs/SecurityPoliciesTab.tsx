"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledNumber, CheckToggle, LabeledTextarea } from "../helpers";
import type { ToastFn, SecurityPolicySettings } from "../types";

type Props = { push: ToastFn };

export default function SecurityPoliciesTab({ push }: Props) {
    const [secPolicies, setSecPolicies] = React.useState<SecurityPolicySettings>({
        passwordMinLength: 12,
        passwordRequireNumbers: true,
        passwordRequireSpecial: true,
        passwordRequireUppercase: true,
        passwordHistory: 5,
        sessionTimeoutMins: 240,
        idleLockMins: 15,
        ipAllowlist: "0.0.0.0/0",
        enableCaptcha: true,
    });

    return (
        <TabsContent value="security_policies" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Security Policies</CardTitle>
                    <CardDescription>Enforce password strength, session timeouts, and network restrictions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Password Policy</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <LabeledNumber label="Minimum length" value={secPolicies.passwordMinLength} onChange={(v) => setSecPolicies(s => ({ ...s, passwordMinLength: v }))} />
                                <LabeledNumber label="Password history (prevent reuse)" value={secPolicies.passwordHistory} onChange={(v) => setSecPolicies(s => ({ ...s, passwordHistory: v }))} />
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                <CheckToggle label="Require numbers" checked={secPolicies.passwordRequireNumbers} onChange={(v) => setSecPolicies(s => ({ ...s, passwordRequireNumbers: v }))} />
                                <CheckToggle label="Require special characters" checked={secPolicies.passwordRequireSpecial} onChange={(v) => setSecPolicies(s => ({ ...s, passwordRequireSpecial: v }))} />
                                <CheckToggle label="Require uppercase letters" checked={secPolicies.passwordRequireUppercase} onChange={(v) => setSecPolicies(s => ({ ...s, passwordRequireUppercase: v }))} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Session &amp; Network</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <LabeledNumber label="Session timeout (minutes)" value={secPolicies.sessionTimeoutMins} onChange={(v) => setSecPolicies(s => ({ ...s, sessionTimeoutMins: v }))} />
                                <LabeledNumber label="Idle lock screen (minutes)" value={secPolicies.idleLockMins} onChange={(v) => setSecPolicies(s => ({ ...s, idleLockMins: v }))} />
                            </div>
                            <LabeledTextarea
                                label="IP Allowlist (CIDR, one per line)"
                                value={secPolicies.ipAllowlist}
                                onChange={(v) => setSecPolicies(s => ({ ...s, ipAllowlist: v }))}
                                rows={5}
                            />
                            <CheckToggle label="Enable CAPTCHA on login" checked={secPolicies.enableCaptcha} onChange={(v) => setSecPolicies(s => ({ ...s, enableCaptcha: v }))} />
                        </CardContent>
                    </Card>

                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "Security policies saved", kind: "success" })}>
                            Save Policies
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
