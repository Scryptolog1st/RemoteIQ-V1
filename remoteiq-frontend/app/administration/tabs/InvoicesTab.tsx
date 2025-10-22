"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { InvoiceConfig, ToastFn } from "../types";
import { LabeledInput, LabeledNumber, LabeledTextarea, CheckToggle } from "../helpers";

interface InvoicesTabProps {
    push: ToastFn;
}

export default function InvoicesTab({ push }: InvoicesTabProps) {
    const [invoices, setInvoices] = React.useState<InvoiceConfig>({
        numberingPrefix: "INV-",
        nextNumber: 1001,
        defaultNetTerms: 30,
        defaultDiscountPct: 0,
        defaultLateFeePct: 0,
        defaultNotes: "Thank you for your business!",
        footer: "RemoteIQ • 123 Example St • Anytown, CA 90210",
        showCompanyAddress: true,
        attachPdfToEmail: true,
        emailFrom: "billing@remoteiq.local",
    });

    return (
        <TabsContent value="invoices" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Invoice Settings</CardTitle>
                    <CardDescription>Configure invoice numbering, defaults, branding and email delivery.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-3 md:grid-cols-3">
                        <LabeledInput label="Numbering prefix" value={invoices.numberingPrefix} onChange={(v) => setInvoices({ ...invoices, numberingPrefix: v })} />
                        <LabeledNumber label="Next number" value={invoices.nextNumber} onChange={(v) => setInvoices({ ...invoices, nextNumber: v })} />
                        <div className="grid gap-1">
                            <Label className="text-sm">Default net terms</Label>
                            <Select
                                value={String(invoices.defaultNetTerms)}
                                onValueChange={(v) => setInvoices({ ...invoices, defaultNetTerms: Number(v) as InvoiceConfig["defaultNetTerms"] })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">Net 7</SelectItem>
                                    <SelectItem value="14">Net 14</SelectItem>
                                    <SelectItem value="30">Net 30</SelectItem>
                                    <SelectItem value="45">Net 45</SelectItem>
                                    <SelectItem value="60">Net 60</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <LabeledNumber label="Default discount (%)" value={invoices.defaultDiscountPct} onChange={(v) => setInvoices({ ...invoices, defaultDiscountPct: v })} />
                        <LabeledNumber label="Late fee (% per period)" value={invoices.defaultLateFeePct} onChange={(v) => setInvoices({ ...invoices, defaultLateFeePct: v })} />
                        <LabeledInput label="Email from" value={invoices.emailFrom} onChange={(v) => setInvoices({ ...invoices, emailFrom: v })} />
                    </div>

                    <div className="grid gap-3">
                        <LabeledTextarea label="Default notes" value={invoices.defaultNotes} onChange={(v) => setInvoices({ ...invoices, defaultNotes: v })} rows={5} />
                        <LabeledTextarea label="Footer / Legal text" value={invoices.footer} onChange={(v) => setInvoices({ ...invoices, footer: v })} rows={4} />
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <CheckToggle
                            label="Show company address on invoices"
                            checked={invoices.showCompanyAddress}
                            onChange={(v) => setInvoices({ ...invoices, showCompanyAddress: v })}
                        />
                        <CheckToggle
                            label="Attach PDF when emailing"
                            checked={invoices.attachPdfToEmail}
                            onChange={(v) => setInvoices({ ...invoices, attachPdfToEmail: v })}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => push({ title: "Sample invoice generated", kind: "success" })}>
                            Generate sample
                        </Button>
                        <Button variant="success" onClick={() => push({ title: "Invoice settings saved", kind: "success" })}>
                            Save invoices
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
