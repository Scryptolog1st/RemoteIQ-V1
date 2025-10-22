//components\remote-tab.tsx

"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Monitor, Terminal, FileText } from 'lucide-react'

const RemoteToolCard = ({ icon, title, description, actionText }: { icon: React.ElementType, title: string, description: string, actionText: string }) => {
    const Icon = icon
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">{title}</CardTitle>
                <Icon className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{description}</p>
                <Button className="w-full">{actionText}</Button>
            </CardContent>
        </Card>
    )
}


export default function RemoteTab() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RemoteToolCard
                icon={Monitor}
                title="Remote Desktop"
                description="Start an interactive remote desktop session. View and control the user's screen in real-time."
                actionText="Start Session"
            />
            <RemoteToolCard
                icon={Terminal}
                title="Remote Shell"
                description="Open a secure PowerShell or bash session directly on the endpoint for advanced command-line tasks."
                actionText="Open Shell"
            />
            <RemoteToolCard
                icon={FileText}
                title="File Browser"
                description="Securely browse, upload, and download files from the endpoint's filesystem."
                actionText="Browse Files"
            />
        </div>
    )
}
