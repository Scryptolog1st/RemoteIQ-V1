"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { ToastFn, TemplateKey, Template } from "../types";
import { LabeledInput, LabeledTextarea } from "../helpers";

interface EmailTemplatesTabProps {
    push: ToastFn;
}

export default function EmailTemplatesTab({ push }: EmailTemplatesTabProps) {
    const [templates, setTemplates] = React.useState<Record<TemplateKey, Template>>({
        invite: {
            subject: "You're invited to RemoteIQ",
            body:
                "Hi {{first_name}},\n\nYou've been invited to join RemoteIQ.\nClick here to accept: {{invite_link}}\n\nThanks,\n{{org_name}}",
        },
        password_reset: {
            subject: "Reset your RemoteIQ password",
            body:
                "Hi {{first_name}},\n\nWe received a request to reset your password.\nReset link: {{reset_link}}\n\nIf you didn't request this, ignore this email.",
        },
        alert: {
            subject: "[RemoteIQ] New alert: {{alert_name}}",
            body:
                "Alert: {{alert_name}}\nSeverity: {{severity}}\nDevice: {{device_name}}\nOccurred: {{timestamp}}\n\nView: {{alert_url}}",
        },
    });

    return (
        <TabsContent value="templates" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>Customize system email subjects & bodies. Variables like <code>{`{{first_name}}`}</code>, <code>{`{{org_name}}`}</code>, <code>{`{{invite_link}}`}</code>.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {([
                        { key: "invite", label: "Invite" },
                        { key: "password_reset", label: "Password reset" },
                        { key: "alert", label: "Alert" },
                    ] as { key: TemplateKey; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="rounded-md border p-3 space-y-3">
                            <div className="font-medium">{label}</div>
                            <LabeledInput
                                label="Subject"
                                value={templates[key].subject}
                                onChange={(v) => setTemplates((prev) => ({ ...prev, [key]: { ...prev[key], subject: v } }))}
                            />
                            <LabeledTextarea
                                label="Body"
                                value={templates[key].body}
                                onChange={(v) => setTemplates((prev) => ({ ...prev, [key]: { ...prev[key], body: v } }))}
                                rows={8}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => push({ title: `Test ${label} email sent`, kind: "success" })}>Send test</Button>
                                <Button variant="success" onClick={() => push({ title: `${label} template saved`, kind: "success" })}>Save {label.toLowerCase()}</Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>
    );
}
