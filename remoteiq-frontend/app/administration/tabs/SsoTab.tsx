"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ToastFn, SsoProvider, SamlConfig, OidcConfig } from "../types";
import { LabeledInput, CheckToggle } from "../helpers";

interface SsoTabProps {
    push: ToastFn;
}

export default function SsoTab({ push }: SsoTabProps) {
    const [ssoProvider, setSsoProvider] = React.useState<SsoProvider>("saml");

    const [saml, setSaml] = React.useState<SamlConfig>({
        metadataUrl: "",
        idpEntityId: "",
        idpSsoUrl: "",
        idpCertificate: "",
        nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        attrEmail: "email",
        attrFirstName: "given_name",
        attrLastName: "family_name",
        attrGroups: "groups",
        jitProvisioning: true,
        groupRoleSync: true,
    });

    const [oidc, setOidc] = React.useState<OidcConfig>({
        issuer: "",
        clientId: "",
        clientSecret: "",
        scopes: "openid email profile",
        discoveryUrl: "",
    });

    return (
        <TabsContent value="sso" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Single Sign-On (SSO)</CardTitle>
                    <CardDescription>Configure SAML 2.0 or OIDC for centralized authentication.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Label className="text-sm">Provider</Label>
                        <Select value={ssoProvider} onValueChange={(v: SsoProvider) => setSsoProvider(v)}>
                            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="saml">SAML 2.0</SelectItem>
                                <SelectItem value="oidc">OIDC (Okta/Azure AD)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {ssoProvider === "saml" ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Metadata URL (IdP)" value={saml.metadataUrl} onChange={(v) => setSaml({ ...saml, metadataUrl: v })} placeholder="https://idp.example.com/metadata" />
                                <LabeledInput label="IdP Entity ID" value={saml.idpEntityId} onChange={(v) => setSaml({ ...saml, idpEntityId: v })} placeholder="urn:example:idp" />
                                <LabeledInput label="IdP SSO URL" value={saml.idpSsoUrl} onChange={(v) => setSaml({ ...saml, idpSsoUrl: v })} placeholder="https://idp.example.com/sso" />
                            </div>

                            <div className="grid gap-1">
                                <Label className="text-sm">IdP Signing Certificate (PEM)</Label>
                                <Textarea value={saml.idpCertificate} onChange={(e) => setSaml({ ...saml, idpCertificate: e.target.value })} rows={6} placeholder="-----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----" />
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="grid gap-1">
                                    <Label className="text-sm">NameID Format</Label>
                                    <Select value={saml.nameIdFormat} onValueChange={(v) => setSaml({ ...saml, nameIdFormat: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">Email</SelectItem>
                                            <SelectItem value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">Persistent</SelectItem>
                                            <SelectItem value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">Unspecified</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <LabeledInput label="SP Entity ID" value="urn:remoteiq:sp" onChange={() => { }} />
                                <LabeledInput label="ACS URL" value="https://portal.remoteiq.local/sso/saml/acs" onChange={() => { }} />
                            </div>

                            <Separator />

                            <div className="grid gap-3 md:grid-cols-4">
                                <LabeledInput label="Attribute: Email" value={saml.attrEmail} onChange={(v) => setSaml({ ...saml, attrEmail: v })} />
                                <LabeledInput label="Attribute: First name" value={saml.attrFirstName} onChange={(v) => setSaml({ ...saml, attrFirstName: v })} />
                                <LabeledInput label="Attribute: Last name" value={saml.attrLastName} onChange={(v) => setSaml({ ...saml, attrLastName: v })} />
                                <LabeledInput label="Attribute: Groups" value={saml.attrGroups} onChange={(v) => setSaml({ ...saml, attrGroups: v })} />
                            </div>

                            <div className="flex flex-wrap items-center gap-6">
                                <CheckToggle label="Just-in-time user provisioning" checked={saml.jitProvisioning} onChange={(v) => setSaml({ ...saml, jitProvisioning: v })} />
                                <CheckToggle label="Map IdP groups to roles" checked={saml.groupRoleSync} onChange={(v) => setSaml({ ...saml, groupRoleSync: v })} />
                            </div>

                            <div className="text-right">
                                <Button variant="success" onClick={() => push({ title: "SAML settings saved", kind: "success" })}>
                                    Save SAML
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Issuer" value={oidc.issuer} onChange={(v) => setOidc({ ...oidc, issuer: v })} placeholder="https://login.microsoftonline.com/{tenant}/v2.0" />
                                <LabeledInput label="Client ID" value={oidc.clientId} onChange={(v) => setOidc({ ...oidc, clientId: v })} />
                                <LabeledInput label="Client Secret" type="password" value={oidc.clientSecret} onChange={(v) => setOidc({ ...oidc, clientSecret: v })} />
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <LabeledInput label="Scopes" value={oidc.scopes} onChange={(v) => setOidc({ ...oidc, scopes: v })} placeholder="openid email profile" />
                                <LabeledInput label="Discovery URL (optional)" value={oidc.discoveryUrl} onChange={(v) => setOidc({ ...oidc, discoveryUrl: v })} placeholder="https://…/.well-known/openid-configuration" />
                                <LabeledInput label="Redirect URI" value="https://portal.remoteiq.local/sso/oidc/callback" onChange={() => { }} />
                            </div>

                            <div className="text-right">
                                <Button variant="success" onClick={() => push({ title: "OIDC settings saved", kind: "success" })}>
                                    Save OIDC
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
    );
}
