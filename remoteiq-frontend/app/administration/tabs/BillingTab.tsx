"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Landmark } from "lucide-react";
import { BillingConfig, ToastFn, Currency, TaxMode } from "../types";
import { LabeledInput, LabeledNumber } from "../helpers";

interface BillingTabProps {
    push: ToastFn;
}

export default function BillingTab({ push }: BillingTabProps) {
    const [billing, setBilling] = React.useState<BillingConfig>({
        currency: "USD",
        taxMode: "exclusive",
        defaultTaxRate: 0,
        statementDescriptor: "REMOTEIQ",
        stripe: { enabled: false, publishableKey: "", secretKey: "", webhookSecret: "" },
        paypal: { enabled: false, clientId: "", clientSecret: "", mode: "sandbox" },
        square: { enabled: false, accessToken: "", locationId: "" },
        authorize: { enabled: false, apiLoginId: "", transactionKey: "" },
        bank: {
            enableACH: false,
            accountHolder: "",
            routingNumber: "",
            accountNumber: "",
            accountType: "",
            bankName: "",
        },
    });

    return (
        <TabsContent value="billing" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Billing Settings</CardTitle>
                    <CardDescription>Configure currency, taxes, payment gateways, and bank/ACH for client billing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="grid gap-1">
                            <Label className="text-sm">Currency</Label>
                            <Select value={billing.currency} onValueChange={(v: Currency) => setBilling({ ...billing, currency: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                    <SelectItem value="GBP">GBP</SelectItem>
                                    <SelectItem value="CAD">CAD</SelectItem>
                                    <SelectItem value="AUD">AUD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-sm">Tax mode</Label>
                            <Select value={billing.taxMode} onValueChange={(v: TaxMode) => setBilling({ ...billing, taxMode: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="exclusive">Tax exclusive</SelectItem>
                                    <SelectItem value="inclusive">Tax inclusive</SelectItem>
                                    <SelectItem value="none">No tax</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <LabeledNumber label="Default tax rate (%)" value={billing.defaultTaxRate} onChange={(v) => setBilling({ ...billing, defaultTaxRate: v })} />
                        <LabeledInput label="Statement descriptor" value={billing.statementDescriptor} onChange={(v) => setBilling({ ...billing, statementDescriptor: v })} />
                    </div>

                    <Separator />

                    {/* Stripe */}
                    <section className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                <div className="font-medium">Stripe</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={billing.stripe.enabled}
                                    onCheckedChange={(v) => setBilling({ ...billing, stripe: { ...billing.stripe, enabled: v } })}
                                />
                                <span className="text-sm">{billing.stripe.enabled ? "Enabled" : "Disabled"}</span>
                            </div>
                        </div>
                        {billing.stripe.enabled && (
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Publishable key" value={billing.stripe.publishableKey} onChange={(v) => setBilling({ ...billing, stripe: { ...billing.stripe, publishableKey: v } })} />
                                <LabeledInput label="Secret key" type="password" value={billing.stripe.secretKey} onChange={(v) => setBilling({ ...billing, stripe: { ...billing.stripe, secretKey: v } })} />
                                <LabeledInput label="Webhook secret" value={billing.stripe.webhookSecret} onChange={(v) => setBilling({ ...billing, stripe: { ...billing.stripe, webhookSecret: v } })} />
                                <LabeledInput label="Webhook endpoint (read-only)" value="https://portal.remoteiq.local/api/billing/stripe/webhook" onChange={() => { }} />
                            </div>
                        )}
                    </section>

                    {/* PayPal */}
                    <section className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">PayPal</div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={billing.paypal.enabled}
                                    onCheckedChange={(v) => setBilling({ ...billing, paypal: { ...billing.paypal, enabled: v } })}
                                />
                                <span className="text-sm">{billing.paypal.enabled ? "Enabled" : "Disabled"}</span>
                            </div>
                        </div>
                        {billing.paypal.enabled && (
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Client ID" value={billing.paypal.clientId} onChange={(v) => setBilling({ ...billing, paypal: { ...billing.paypal, clientId: v } })} />
                                <LabeledInput label="Client Secret" type="password" value={billing.paypal.clientSecret} onChange={(v) => setBilling({ ...billing, paypal: { ...billing.paypal, clientSecret: v } })} />
                                <div className="grid gap-1">
                                    <Label className="text-sm">Mode</Label>
                                    <Select value={billing.paypal.mode} onValueChange={(v: "live" | "sandbox") => setBilling({ ...billing, paypal: { ...billing.paypal, mode: v } })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sandbox">Sandbox</SelectItem>
                                            <SelectItem value="live">Live</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Square */}
                    <section className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">Square</div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={billing.square.enabled}
                                    onCheckedChange={(v) => setBilling({ ...billing, square: { ...billing.square, enabled: v } })}
                                />
                                <span className="text-sm">{billing.square.enabled ? "Enabled" : "Disabled"}</span>
                            </div>
                        </div>
                        {billing.square.enabled && (
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Access token" type="password" value={billing.square.accessToken} onChange={(v) => setBilling({ ...billing, square: { ...billing.square, accessToken: v } })} />
                                <LabeledInput label="Location ID" value={billing.square.locationId} onChange={(v) => setBilling({ ...billing, square: { ...billing.square, locationId: v } })} />
                            </div>
                        )}
                    </section>

                    {/* Authorize.Net */}
                    <section className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="font-medium">Authorize.Net</div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={billing.authorize.enabled}
                                    onCheckedChange={(v) => setBilling({ ...billing, authorize: { ...billing.authorize, enabled: v } })}
                                />
                                <span className="text-sm">{billing.authorize.enabled ? "Enabled" : "Disabled"}</span>
                            </div>
                        </div>
                        {billing.authorize.enabled && (
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="API Login ID" value={billing.authorize.apiLoginId} onChange={(v) => setBilling({ ...billing, authorize: { ...billing.authorize, apiLoginId: v } })} />
                                <LabeledInput label="Transaction Key" type="password" value={billing.authorize.transactionKey} onChange={(v) => setBilling({ ...billing, authorize: { ...billing.authorize, transactionKey: v } })} />
                            </div>
                        )}
                    </section>

                    <Separator />

                    {/* Bank / ACH */}
                    <section className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Landmark className="h-4 w-4" />
                                <div className="font-medium">Bank / ACH</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={billing.bank.enableACH}
                                    onCheckedChange={(v) => setBilling({ ...billing, bank: { ...billing.bank, enableACH: v } })}
                                />
                                <span className="text-sm">{billing.bank.enableACH ? "Enabled" : "Disabled"}</span>
                            </div>
                        </div>
                        {billing.bank.enableACH && (
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Account holder" value={billing.bank.accountHolder} onChange={(v) => setBilling({ ...billing, bank: { ...billing.bank, accountHolder: v } })} />
                                <LabeledInput label="Bank name" value={billing.bank.bankName} onChange={(v) => setBilling({ ...billing, bank: { ...billing.bank, bankName: v } })} />
                                <LabeledInput label="Routing number" value={billing.bank.routingNumber} onChange={(v) => setBilling({ ...billing, bank: { ...billing.bank, routingNumber: v } })} />
                                <LabeledInput label="Account number" type="password" value={billing.bank.accountNumber} onChange={(v) => setBilling({ ...billing, bank: { ...billing.bank, accountNumber: v } })} />
                                <div className="grid gap-1">
                                    <Label className="text-sm">Account type</Label>
                                    <Select
                                        value={billing.bank.accountType}
                                        onValueChange={(v: "checking" | "savings") => setBilling({ ...billing, bank: { ...billing.bank, accountType: v } })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="checking">Checking</SelectItem>
                                            <SelectItem value="savings">Savings</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => push({ title: "Testing gateways…", kind: "default" })}>
                            Test gateways
                        </Button>
                        <Button variant="success" onClick={() => push({ title: "Billing settings saved", kind: "success" })}>
                            Save billing
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
