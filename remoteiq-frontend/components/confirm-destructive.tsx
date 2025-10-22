//components\confirm-destructive.tsx

"use client";

import * as React from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Props = {
    /** Button label (e.g., 'Delete') */
    label?: string;
    /** Optional icon (defaults to <Trash2/>) */
    icon?: React.ReactNode;
    /** Extra classNames for the trigger button */
    className?: string;
    /** Dialog title/description */
    title?: string;
    description?: string;
    /** Called after confirm click */
    onConfirm: () => void | Promise<void>;
    /** Optional render prop to customize the trigger (must be a Button) */
    children?: React.ReactNode;
};

/** Destructive red trigger + confirm dialog */
export default function ConfirmDestructive({
    label = "Delete",
    icon,
    className,
    title = "Are you sure?",
    description = "This action cannot be undone.",
    onConfirm,
    children,
}: Props) {
    const [open, setOpen] = React.useState(false);
    const handle = async () => {
        await onConfirm();
        setOpen(false);
    };

    const Trigger = children ? (
        <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    ) : (
        <AlertDialogTrigger asChild>
            <Button
                variant="destructive"
                size="sm"
                className={className}
                aria-label={label}
                title={label}
            >
                {icon ?? <Trash2 className="h-4 w-4 mr-2" />}
                {label}
            </Button>
        </AlertDialogTrigger>
    );

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            {Trigger}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handle}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {label}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
