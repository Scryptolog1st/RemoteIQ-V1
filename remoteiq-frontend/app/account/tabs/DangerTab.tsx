"use client";

import * as React from "react";
import { useToast } from "@/lib/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShieldAlert, Trash2, Archive } from "lucide-react";
import { AuditPanel } from "../components/AuditPanel";

type Props = { onDirtyChange: (dirty: boolean) => void; saveHandleRef: (h: { submit: () => void }) => void };

/**
 * Danger tab:
 * - Two-step destructive actions with typed confirmation.
 * - Mocked outcomes with toasts.
 */

export default function DangerTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const ACCOUNT_NAME = "Acme MSP";

  React.useEffect(() => {
    onDirtyChange(false);
    saveHandleRef({ submit: () => void 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProceed = confirmText.trim() === ACCOUNT_NAME;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />Danger zone
          </CardTitle>
          <CardDescription>These actions are destructive. Proceed with caution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Archive account</div>
                <div className="text-xs text-muted-foreground">Temporarily disable access and billing.</div>
              </div>
              <Button variant="outline" onClick={() => { setConfirmText(""); setArchiveOpen(true); }}>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-red-600">Delete account</div>
                <div className="text-xs text-muted-foreground">This will permanently delete data.</div>
              </div>
              <Button variant="destructive" onClick={() => { setConfirmText(""); setDeleteOpen(true); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AuditPanel section="danger" />

      {/* Archive dialog */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm archive</AlertDialogTitle>
            <AlertDialogDescription>
              Type the account name <strong>{ACCOUNT_NAME}</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="Type account name to confirm"
            placeholder={ACCOUNT_NAME}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!canProceed) return;
                setArchiveOpen(false);
                push({ title: "Account archived", kind: "success" });
              }}
              disabled={!canProceed}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Type <strong>{ACCOUNT_NAME}</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="Type account name to confirm"
            placeholder={ACCOUNT_NAME}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!canProceed) return;
                setDeleteOpen(false);
                push({ title: "Account deleted", kind: "destructive" });
              }}
              disabled={!canProceed}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
