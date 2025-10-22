"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Cloud } from "lucide-react";
import { ToastFn, S3Config, StorageBackend, S3Provider } from "../types";
import { LabeledInput, CheckToggle } from "../helpers";

interface StorageTabProps {
    push: ToastFn;
}

export default function StorageTab({ push }: StorageTabProps) {
    const [s3, setS3] = React.useState<S3Config>({
        enabled: false,
        backend: "local",
        provider: "aws",
        accessKeyId: "",
        secretAccessKey: "",
        bucket: "",
        region: "us-east-1",
        endpoint: "",
        prefix: "",
        pathStyle: false,
        sse: "none",
        kmsKeyId: "",
    });

    return (
        <TabsContent value="storage" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Storage</CardTitle>
                    <CardDescription>Use S3-compatible storage instead of local storage for artifacts, exports, and backups.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Cloud className="h-4 w-4" />
                                <div className="font-medium">Backend</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Label className="text-sm">Use S3</Label>
                                <Switch checked={s3.backend === "s3"} onCheckedChange={(v) => setS3((prev) => ({ ...prev, backend: v ? "s3" : "local" }))} />
                            </div>
                        </div>

                        {s3.backend === "s3" && (
                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="grid gap-1">
                                        <Label className="text-sm">Provider</Label>
                                        <Select value={s3.provider} onValueChange={(v: S3Provider) => setS3({ ...s3, provider: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="aws">AWS S3</SelectItem>
                                                <SelectItem value="minio">MinIO</SelectItem>
                                                <SelectItem value="wasabi">Wasabi</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <LabeledInput label="Region" value={s3.region} onChange={(v) => setS3({ ...s3, region: v })} />
                                    <LabeledInput label="Bucket" value={s3.bucket} onChange={(v) => setS3({ ...s3, bucket: v })} />
                                    <LabeledInput label="Access Key ID" value={s3.accessKeyId} onChange={(v) => setS3({ ...s3, accessKeyId: v })} />
                                    <LabeledInput label="Secret Access Key" type="password" value={s3.secretAccessKey} onChange={(v) => setS3({ ...s3, secretAccessKey: v })} />
                                    <LabeledInput label="Endpoint (for MinIO/Other)" value={s3.endpoint} onChange={(v) => setS3({ ...s3, endpoint: v })} />
                                    <LabeledInput label="Key prefix (optional)" value={s3.prefix} onChange={(v) => setS3({ ...s3, prefix: v })} />
                                    <div className="flex items-center gap-4 mt-6">
                                        <CheckToggle label="Path-style access" checked={s3.pathStyle} onChange={(v) => setS3({ ...s3, pathStyle: v })} />
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="grid gap-1">
                                        <Label className="text-sm">Server-side encryption</Label>
                                        <Select value={s3.sse} onValueChange={(v: "none" | "AES256" | "aws:kms") => setS3({ ...s3, sse: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="AES256">AES256</SelectItem>
                                                <SelectItem value="aws:kms">AWS KMS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {s3.sse === "aws:kms" && (
                                        <LabeledInput label="KMS Key ID (ARN)" value={s3.kmsKeyId} onChange={(v) => setS3({ ...s3, kmsKeyId: v })} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => push({ title: "Testing storage…", kind: "default" })}>
                            Test storage
                        </Button>
                        <Button variant="success" onClick={() => push({ title: "Storage settings saved", kind: "success" })}>
                            Save storage
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
