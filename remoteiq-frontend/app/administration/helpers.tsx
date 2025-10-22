// app/administration/helpers.tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ------------------- Inputs ------------------- */

export function LabeledInput({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    className,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    className?: string;
}) {
    return (
        <div className={cn("grid gap-1", className)}>
            <Label className="text-sm">{label}</Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                type={type}
                placeholder={placeholder}
            />
        </div>
    );
}

export function LabeledTextarea({
    label,
    value,
    onChange,
    rows = 6,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
}) {
    return (
        <div className="grid gap-1">
            <Label className="text-sm">{label}</Label>
            <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} />
        </div>
    );
}

export function LabeledNumber({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number | "";
    onChange: (v: number | "") => void;
}) {
    return (
        <div className="grid gap-1">
            <Label className="text-sm">{label}</Label>
            <Input
                inputMode="numeric"
                value={value}
                onChange={(e) => {
                    const v = e.target.value;
                    onChange(v === "" ? "" : Number(v));
                }}
            />
        </div>
    );
}

export function CheckToggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="inline-flex items-center gap-2">
            <Switch checked={checked} onCheckedChange={onChange} />
            <span className="text-sm">{label}</span>
        </label>
    );
}

export function LabeledSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
}) {
    return (
        <div className="grid gap-1">
            <Label className="text-sm">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/* ------------------- Layout helpers ------------------- */

export function SettingCard({
    icon,
    title,
    desc,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
                {icon}
                <div className="font-medium">{title}</div>
            </div>
            <div className="text-xs text-muted-foreground mb-3">{desc}</div>
            {children}
        </div>
    );
}

/* ------------------- Admin/Toast types ------------------- */

export type ToastKind = "default" | "success" | "destructive" | "warning";

export type Toast = {
    id: string;
    title: string;
    desc?: string;
    kind: ToastKind;
};

/**
 * Broad, forgiving signature to match callers in page.tsx and tabs.
 * `kind` is optional; default it in your toast impl if omitted.
 */
export type ToastFn = (o: { title: string; desc?: string; kind?: ToastKind }) => void;

/* ------------------- Roles/Permissions row ------------------- */

export function PermRow({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40">
            <div>
                <div className="font-medium">{label}</div>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            <div>{children}</div>
        </div>
    );
}
