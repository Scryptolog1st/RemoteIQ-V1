//components\sidebar.tsx

"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronRight, ChevronDown, Building2, Users2, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/app/(dashboard)/dashboard-context";

type SiteKey = `${string}|${string}`; // "Org|Site"

export default function Sidebar() {
    const pathname = usePathname();
    const isCustomers = pathname.startsWith("/customers");
    const { masterDevices } = useDashboard();

    // Build Clients → Sites tree
    const tree = React.useMemo(() => {
        const byOrg = new Map<string, Set<string>>();
        for (const d of masterDevices) {
            if (!byOrg.has(d.client)) byOrg.set(d.client, new Set());
            byOrg.get(d.client)!.add(d.site);
        }
        return Array.from(byOrg.entries())
            .map(([org, set]) => ({ org, sites: Array.from(set).sort((a, b) => a.localeCompare(b)) }))
            .sort((a, b) => a.org.localeCompare(b.org));
    }, [masterDevices]);

    const allOrgNames = React.useMemo(() => tree.map(t => t.org), [tree]);

    const router = useRouter();
    const qs = useSearchParams();

    const scope = qs.get("scope") || "";
    const orgsParam = qs.get("orgs") || "";
    const sitesParam = qs.get("sites") || "";

    const expandedOrgs = React.useMemo(() => {
        const list = orgsParam ? orgsParam.split(",").filter(Boolean) : [];
        return new Set(list.filter((o) => allOrgNames.includes(o)));
    }, [orgsParam, allOrgNames]);

    const selectedSites = React.useMemo(() => {
        const list = sitesParam ? sitesParam.split(",").filter(Boolean) : [];
        const valid = new Set<SiteKey>();
        for (const item of list) {
            const [org, site] = item.split("|");
            if (!org || !site) continue;
            const entry = tree.find((t) => t.org === org);
            if (entry && entry.sites.includes(site)) valid.add(`${org}|${site}`);
        }
        return valid;
    }, [sitesParam, tree]);

    const setQuery = React.useCallback((updater: (u: URL) => void) => {
        const url = new URL(window.location.href);
        updater(url);
        router.replace(`${url.pathname}?${url.searchParams.toString()}`);
    }, [router]);

    const gotoRootCustomers = () => {
        setQuery((url) => {
            url.searchParams.set("scope", "customers");
            url.searchParams.delete("orgs");
            url.searchParams.delete("sites");
        });
    };

    const toggleOrg = (org: string) => {
        const next = new Set(expandedOrgs);
        next.has(org) ? next.delete(org) : next.add(org);
        setQuery((url) => {
            url.searchParams.set("scope", "customers");
            url.searchParams.set("orgs", Array.from(next).join(","));
            // trim sites to only those under expanded orgs
            const kept = Array.from(selectedSites).filter((s) => next.has(s.split("|")[0]!));
            if (kept.length) url.searchParams.set("sites", kept.join(","));
            else url.searchParams.delete("sites");
        });
    };

    const toggleSite = (org: string, site: string) => {
        const key = `${org}|${site}` as SiteKey;
        const nextSites = new Set<SiteKey>(selectedSites);
        nextSites.has(key) ? nextSites.delete(key) : nextSites.add(key);

        const nextOrgs = new Set(expandedOrgs);
        nextOrgs.add(org);

        setQuery((url) => {
            url.searchParams.set("scope", "customers");
            url.searchParams.set("orgs", Array.from(nextOrgs).join(","));
            if (nextSites.size) url.searchParams.set("sites", Array.from(nextSites).join(","));
            else url.searchParams.delete("sites");
        });
    };

    const rootActive = isCustomers && scope === "customers";
    const orgIsExpanded = (org: string) => expandedOrgs.has(org);
    const siteIsSelected = (org: string, site: string) => selectedSites.has(`${org}|${site}`);

    return (
        <aside
            className={cn(
                "w-64 shrink-0 border-r bg-background",
                // starts below top bar; its own scroller
                "h-[calc(100vh-3.5rem)] overflow-y-auto"
            )}
        >
            <div className="px-3 py-2">
                {/* Customers root */}
                <button
                    onClick={gotoRootCustomers}
                    className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                        rootActive ? "bg-accent text-accent-foreground" : "text-foreground"
                    )}
                    title="Customers"
                >
                    <Users2 className="h-4 w-4" />
                    <span className="truncate">Customers</span>
                </button>

                {/* Orgs + sites */}
                <div className="mt-2 space-y-1">
                    {tree.map(({ org, sites }) => (
                        <div key={org}>
                            <button
                                onClick={() => toggleOrg(org)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                                    orgIsExpanded(org) ? "bg-muted" : ""
                                )}
                                title={org}
                            >
                                {orgIsExpanded(org) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <Building2 className="h-4 w-4 opacity-70" />
                                <span className="truncate">{org}</span>
                            </button>

                            {orgIsExpanded(org) && (
                                <div className="ml-6 mt-1 space-y-1">
                                    {sites.map((site) => (
                                        <button
                                            key={site}
                                            onClick={() => toggleSite(org, site)}
                                            className={cn(
                                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                                                siteIsSelected(org, site) ? "bg-accent text-accent-foreground" : "text-foreground"
                                            )}
                                            title={`${org} • ${site}`}
                                        >
                                            <Monitor className="h-3.5 w-3.5 opacity-70" />
                                            <span className="truncate">{site}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
