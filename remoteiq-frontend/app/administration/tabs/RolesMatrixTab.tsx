"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Check, X } from "lucide-react";

export type RolesMatrixTabProps = {
    push: (t: any) => void;
};

export default function RolesMatrixTab({ push }: RolesMatrixTabProps) {
    const permissions = ['View Devices', 'Manage Devices', 'Manage Users', 'View Billing', 'View Audit Logs', 'Manage API'];
    const roles = [
        { name: 'Technician', perms: [true, false, false, false, true, false] },
        { name: 'Admin', perms: [true, true, true, true, true, true] },
        { name: 'Read Only', perms: [true, false, false, false, true, false] },
    ];

    return (
        <TabsContent value="roles_matrix">
            <Card>
                <CardHeader>
                    <CardTitle>Roles Matrix</CardTitle>
                    <CardDescription>
                        Compare permissions across all roles in a grid view.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="p-2 text-left font-medium">Permission</th>
                                    {roles.map(r => <th key={r.name} className="p-2 font-medium">{r.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {permissions.map((perm, pIndex) => (
                                    <tr key={perm} className="border-b last:border-b-0">
                                        <td className="p-2 font-medium">{perm}</td>
                                        {roles.map((role, rIndex) => (
                                            <td key={role.name} className="p-2 text-center">
                                                {role.perms[pIndex]
                                                    ? <Check className="h-5 w-5 text-green-500 mx-auto" />
                                                    : <X className="h-5 w-5 text-muted-foreground mx-auto" />
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
