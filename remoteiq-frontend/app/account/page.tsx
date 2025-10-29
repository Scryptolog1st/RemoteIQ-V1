"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/toast";              // ✅ use hook only (provider is in root)
import { usePersistedTab } from "@/lib/use-persisted-tab";

import ProfileTab from "./tabs/ProfileTab";
import SecurityTab from "./tabs/SecurityTab";
import SessionsTab from "./tabs/SessionsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import IntegrationsTab from "./tabs/IntegrationsTab";
import ApiTab from "./tabs/ApiTab";
import DeveloperTab from "./tabs/DeveloperTab";
import DangerTab from "./tabs/DangerTab";

type TabKey =
    | "profile"
    | "security"
    | "sessions"
    | "notifications"
    | "integrations"
    | "api"
    | "developer"
    | "danger";

const ALLOWED_TABS = [
    "profile",
    "security",
    "sessions",
    "notifications",
    "integrations",
    "api",
    "developer",
    "danger",
] as const;

const HIGH_RISK_TABS = new Set<TabKey>(["security", "integrations", "api", "danger"]);

export default function AccountPage() {
    const { toast } = useToast();

    const [activeTab, setActiveTab] = usePersistedTab({
        storageKey: "account.activeTab",
        allowed: ALLOWED_TABS,
        defaultValue: "profile",
        urlParam: "tab",
    });

    const [dirtyByTab, setDirtyByTab] = React.useState<Record<TabKey, boolean>>({
        profile: false,
        security: false,
        sessions: false,
        notifications: false,
        integrations: false,
        api: false,
        developer: false,
        danger: false,
    });

    const saveHandles = React.useRef<Record<TabKey, { submit: () => void } | null>>({
        profile: null,
        security: null,
        sessions: null,
        notifications: null,
        integrations: null,
        api: null,
        developer: null,
        danger: null,
    });

    const [pendingTab, setPendingTab] = React.useState<TabKey | null>(null);
    const [confirmOpen, setConfirmOpen] = React.useState(false);

    const onTabChange = (next: string) => {
        const nextTab = next as TabKey;
        if (nextTab === activeTab) return;

        const isDirty = dirtyByTab[activeTab as TabKey];
        const isHighRisk = HIGH_RISK_TABS.has(activeTab as TabKey);

        if (isDirty && isHighRisk) {
            setPendingTab(nextTab);
            setConfirmOpen(true);
            return;
        }
        setActiveTab(nextTab);
    };

    const confirmLeave = () => {
        setConfirmOpen(false);
        if (pendingTab) {
            const prev = activeTab as TabKey;
            setActiveTab(pendingTab);
            setPendingTab(null);
            toast({
                title: "Unsaved changes discarded",
                variant: "default", // ✅ valid variant
            });
            setDirtyByTab((prevState) => ({ ...prevState, [prev]: false }));
        }
    };

    const cancelLeave = () => {
        setConfirmOpen(false);
        setPendingTab(null);
    };

    const registerSaveHandle =
        (tab: TabKey) =>
            (h: { submit: () => void }) => {
                saveHandles.current[tab] = h;
            };

    const setDirty =
        (tab: TabKey) =>
            (dirty: boolean) => {
                setDirtyByTab((prev) => (prev[tab] === dirty ? prev : { ...prev, [tab]: dirty }));
            };

    return (
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-6">
            <Card className="mb-4 p-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Manage your account settings. Press <kbd>⌘/Ctrl+S</kbd> to save in any tab.
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            const h = saveHandles.current[activeTab as TabKey];
                            if (h) h.submit();
                        }}
                        disabled={!dirtyByTab[activeTab as TabKey]}
                        aria-label="Save current tab"
                    >
                        Save
                    </Button>
                </div>
            </Card>

            <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
                <TabsList className="flex flex-wrap">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                    <TabsTrigger value="api">API</TabsTrigger>
                    <TabsTrigger value="developer">Developer</TabsTrigger>
                    <TabsTrigger value="danger">Danger</TabsTrigger>
                </TabsList>
                <Separator />

                <TabsContent value="profile" className="space-y-4">
                    <ProfileTab onDirtyChange={setDirty("profile")} saveHandleRef={registerSaveHandle("profile")} />
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                    <SecurityTab onDirtyChange={setDirty("security")} saveHandleRef={registerSaveHandle("security")} />
                </TabsContent>

                <TabsContent value="sessions" className="space-y-4">
                    <SessionsTab onDirtyChange={setDirty("sessions")} saveHandleRef={registerSaveHandle("sessions")} />
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                    <NotificationsTab onDirtyChange={setDirty("notifications")} saveHandleRef={registerSaveHandle("notifications")} />
                </TabsContent>

                <TabsContent value="integrations" className="space-y-4">
                    <IntegrationsTab onDirtyChange={setDirty("integrations")} saveHandleRef={registerSaveHandle("integrations")} />
                </TabsContent>

                <TabsContent value="api" className="space-y-4">
                    <ApiTab onDirtyChange={setDirty("api")} saveHandleRef={registerSaveHandle("api")} />
                </TabsContent>

                <TabsContent value="developer" className="space-y-4">
                    <DeveloperTab onDirtyChange={setDirty("developer")} saveHandleRef={registerSaveHandle("developer")} />
                </TabsContent>

                <TabsContent value="danger" className="space-y-4">
                    <DangerTab onDirtyChange={setDirty("danger")} saveHandleRef={registerSaveHandle("danger")} />
                </TabsContent>
            </Tabs>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes on this tab. If you leave now, they’ll be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelLeave}>Stay</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmLeave}>Discard</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
