// app/administration/tabs/SupportTab.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { TabsContent } from "@/components/ui/tabs";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledTextarea, SettingCard } from "../helpers";
import type { ToastFn } from "../types";
import { useBranding } from "@/app/providers/BrandingProvider";
import {
    getSupportLegalSettings,
    saveSupportLegalSettings,
    type SupportLegalSettings,
} from "@/lib/api";
import { LifeBuoy, Scale } from "lucide-react";

/** Try common logo property names without changing your Branding types */
function pickLogoUrl(b: unknown): string | undefined {
    const x = (b as any) || {};
    return (
        x.logoUrl ||
        x.logoURL ||
        x.logo ||
        x.logoLight ||
        x.logoDark ||
        x.logoPublicUrl ||
        x.logo_url ||
        x.logo_light ||
        x.logo_dark ||
        undefined
    );
}

export default function SupportTab({ push }: { push: ToastFn }) {
    const { branding } = useBranding();
    const primary: string = (branding as any)?.primaryColor || "#0ea5e9";
    const logoUrl = pickLogoUrl(branding);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const [form, setForm] = React.useState<SupportLegalSettings>({
        supportEmail: "",
        supportPhone: "",
        ticketPortalUrl: "",
        knowledgeBaseUrl: "",
        statusPageUrl: "",
        phoneHours: "",
        notesHtml: "",
        privacyPolicyUrl: "",
        termsUrl: "",
        gdprContactEmail: "",
        legalAddress: "",
    });

    React.useEffect(() => {
        (async () => {
            try {
                const data = await getSupportLegalSettings();
                setForm((prev) => ({ ...prev, ...(data as any) }));
            } catch (e: any) {
                push({
                    title: "Failed to load Support & Legal",
                    desc: e?.message,
                    kind: "destructive",
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [push]);

    function set<K extends keyof SupportLegalSettings>(
        key: K,
        value: SupportLegalSettings[K]
    ) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function onSave() {
        setSaving(true);
        try {
            const { id, ...payload } = (form as any) || {};
            await saveSupportLegalSettings(payload as SupportLegalSettings);
            push({ title: "Support & Legal saved", kind: "success" });
        } catch (e: any) {
            push({ title: "Save failed", desc: e?.message, kind: "destructive" });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return null;

    return (
        <TabsContent value="support" className="mt-0">
            <Card>
                <CardHeader className="gap-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Support &amp; Legal</CardTitle>
                            <CardDescription>
                                Centralize your support contacts, portals, and legal links. These
                                surface in the client portal and outbound emails.
                            </CardDescription>
                        </div>

                        {logoUrl ? (
                            <div className="flex items-center justify-center rounded-md border bg-card p-2">
                                <Image
                                    src={logoUrl}
                                    alt="Organization Logo"
                                    width={120}
                                    height={40}
                                    unoptimized
                                    priority
                                    style={{ objectFit: "contain" }}
                                />
                            </div>
                        ) : null}
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Support */}
                    <SettingCard
                        icon={<LifeBuoy className="h-5 w-5" />} // no forced color
                        title="Support"
                        desc="Primary channels your customers use when they need help."
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LabeledInput
                                label="Support Email"
                                value={form.supportEmail ?? ""}
                                onChange={(v) => set("supportEmail", v)}
                            />
                            <LabeledInput
                                label="Support Phone"
                                value={form.supportPhone ?? ""}
                                onChange={(v) => set("supportPhone", v)}
                            />

                            <LabeledInput
                                label="Ticket Portal URL"
                                value={form.ticketPortalUrl ?? ""}
                                onChange={(v) => set("ticketPortalUrl", v)}
                            />
                            <LabeledInput
                                label="Knowledge Base URL"
                                value={form.knowledgeBaseUrl ?? ""}
                                onChange={(v) => set("knowledgeBaseUrl", v)}
                            />

                            <LabeledInput
                                label="Status Page URL"
                                value={form.statusPageUrl ?? ""}
                                onChange={(v) => set("statusPageUrl", v)}
                            />
                            <LabeledInput
                                label="Support Phone Hours"
                                value={form.phoneHours ?? ""}
                                onChange={(v) => set("phoneHours", v)}
                            />

                            {/* Full-width Notes on md+ */}
                            <div className="md:col-span-2">
                                <LabeledTextarea
                                    label="Notes (HTML allowed)"
                                    value={form.notesHtml ?? ""}
                                    onChange={(v) => set("notesHtml", v)}
                                    rows={6}
                                />
                            </div>
                        </div>
                    </SettingCard>

                    {/* Legal */}
                    <SettingCard
                        icon={<Scale className="h-5 w-5" />} // no forced color
                        title="Legal"
                        desc="Links and contacts for your policies and compliance."
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LabeledInput
                                label="Privacy Policy URL"
                                value={form.privacyPolicyUrl ?? ""}
                                onChange={(v) => set("privacyPolicyUrl", v)}
                            />
                            <LabeledInput
                                label="Terms of Service URL"
                                value={form.termsUrl ?? ""}
                                onChange={(v) => set("termsUrl", v)}
                            />

                            <LabeledInput
                                label="GDPR Contact Email"
                                value={form.gdprContactEmail ?? ""}
                                onChange={(v) => set("gdprContactEmail", v)}
                            />

                            {/* Full-width Legal Address for visual parity */}
                            <div className="md:col-span-2">
                                <LabeledTextarea
                                    label="Legal Address"
                                    value={form.legalAddress ?? ""}
                                    onChange={(v) => set("legalAddress", v)}
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <Button
                                onClick={onSave}
                                disabled={saving}
                                style={
                                    primary
                                        ? ({
                                            ["--brand-primary" as any]: primary,
                                        } as React.CSSProperties)
                                        : undefined
                                }
                                className={
                                    primary
                                        ? "border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
                                        : ""
                                }
                            >
                                {saving ? "Saving..." : "Save changes"}
                            </Button>
                        </div>
                    </SettingCard>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
