// app/customers/customers-sidebar.tsx
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomers } from "./customers-context";

/**
 * Customers Sidebar
 * - Badges show endpoint counts:
 *   • Root "Customers" badge: total endpoints
 *   • Org badge: total endpoints in that org
 *   • Site badge: total endpoints in that site
 */

export default function CustomersSidebar() {
    const router = useRouter();
    const pathname = usePathname();

    const {
        customersGroupOpen,
        toggleCustomersGroup,
        expandedOrganizations,
        expandedSites,
        onExpandChange,
        masterDevices,
    } = useCustomers();

    // Build orgs, sites list, and endpoint counts
    const { orgs, sitesByOrg, siteDeviceCounts, orgDeviceCounts, totalEndpoints } =
        React.useMemo(() => {
            const orgSet = new Set<string>();
            const sitesMap: Record<string, string[]> = {};
            const siteCounts: Record<string, Record<string, number>> = {};
            const orgCounts: Record<string, number> = {};
            let total = 0;

            for (const d of masterDevices) {
                total += 1;
                orgSet.add(d.client);

                // sites per org
                if (!sitesMap[d.client]) sitesMap[d.client] = [];
                if (!sitesMap[d.client].includes(d.site)) sitesMap[d.client].push(d.site);

                // site endpoint counts
                if (!siteCounts[d.client]) siteCounts[d.client] = {};
                siteCounts[d.client][d.site] = (siteCounts[d.client][d.site] ?? 0) + 1;

                // org endpoint counts
                orgCounts[d.client] = (orgCounts[d.client] ?? 0) + 1;
            }

            const sortedOrgs = Array.from(orgSet).sort();
            for (const org of Object.keys(sitesMap)) {
                sitesMap[org].sort();
            }

            return {
                orgs: sortedOrgs,
                sitesByOrg: sitesMap,
                siteDeviceCounts: siteCounts,
                orgDeviceCounts: orgCounts,
                totalEndpoints: total,
            };
        }, [masterDevices]);

    const goCustomers = React.useCallback(() => {
        if (!customersGroupOpen) toggleCustomersGroup(true);
        if (pathname !== "/customers") router.push("/customers");
    }, [customersGroupOpen, pathname, router, toggleCustomersGroup]);

    // a11y: keyboard toggle helpers for org/site rows
    const onKeyToggle =
        (fn: () => void) =>
            (e: React.KeyboardEvent<HTMLButtonElement>) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fn();
                }
            };

    return (
        <aside
            className="w-64 shrink-0 border-r bg-background"
            aria-label="Customers sidebar"
            style={{ height: "calc(100vh - 56px)" }} // below fixed TopBar (56px tall)
        >
            {/* Tree container for better a11y */}
            <div className="p-2 text-sm" role="tree" aria-label="Customers Tree">
                {/* Root: Customers (badge = total endpoints) */}
                <button
                    type="button"
                    role="treeitem"
                    aria-level={1}
                    aria-selected={pathname === "/customers"}
                    aria-expanded={customersGroupOpen}
                    onClick={goCustomers}
                    onKeyDown={onKeyToggle(goCustomers)}
                    className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent hover:text-accent-foreground",
                        pathname === "/customers" && "bg-accent"
                    )}
                    title="Customers"
                    aria-controls="customers-tree-root"
                >
                    <ChevronRight
                        className={cn(
                            "h-4 w-4 transition-transform",
                            customersGroupOpen && "rotate-90"
                        )}
                        aria-hidden="true"
                    />
                    <span className="font-medium">Customers</span>
                    <span className="ml-auto rounded bg-muted px-1.5 text-xs text-muted-foreground">
                        {totalEndpoints}
                    </span>
                </button>

                {/* Orgs & Sites (only when open) */}
                <div
                    id="customers-tree-root"
                    role="group"
                    className={cn("mt-1 pl-5", !customersGroupOpen && "hidden")}
                >
                    {customersGroupOpen &&
                        orgs.map((org) => {
                            const isOrgExpanded = expandedOrganizations.has(org);
                            const orgGroupId = `org-${encodeURIComponent(org)}`;
                            const sites = sitesByOrg[org] ?? [];
                            const orgCount = orgDeviceCounts[org] ?? 0;

                            return (
                                <div key={org} className="mb-1">
                                    {/* Organization row (badge = endpoints in org) */}
                                    <button
                                        type="button"
                                        role="treeitem"
                                        aria-level={2}
                                        aria-selected={isOrgExpanded}
                                        aria-expanded={isOrgExpanded}
                                        aria-controls={orgGroupId}
                                        onClick={() =>
                                            onExpandChange("organization", org, !isOrgExpanded, sites)
                                        }
                                        onKeyDown={onKeyToggle(() =>
                                            onExpandChange("organization", org, !isOrgExpanded, sites)
                                        )}
                                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
                                        title={org}
                                    >
                                        <ChevronRight
                                            className={cn(
                                                "h-4 w-4 transition-transform",
                                                isOrgExpanded && "rotate-90"
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{org}</span>
                                        <span className="ml-auto rounded bg-muted px-1.5 text-xs text-muted-foreground">
                                            {orgCount}
                                        </span>
                                    </button>

                                    {/* Sites under org (badge = endpoints in site) */}
                                    <div
                                        id={orgGroupId}
                                        role="group"
                                        className={cn("mt-1 pl-5", !isOrgExpanded && "hidden")}
                                    >
                                        {isOrgExpanded &&
                                            sites.map((site) => {
                                                const isSiteExpanded = expandedSites.has(site);
                                                const count = siteDeviceCounts[org]?.[site] ?? 0;
                                                const siteId = `site-${encodeURIComponent(org)}-${encodeURIComponent(
                                                    site
                                                )}`;

                                                return (
                                                    <button
                                                        key={site}
                                                        type="button"
                                                        role="treeitem"
                                                        aria-level={3}
                                                        aria-selected={isSiteExpanded}
                                                        aria-expanded={isSiteExpanded}
                                                        aria-controls={siteId}
                                                        onClick={() =>
                                                            onExpandChange("site", site, !isSiteExpanded)
                                                        }
                                                        onKeyDown={onKeyToggle(() =>
                                                            onExpandChange("site", site, !isSiteExpanded)
                                                        )}
                                                        className={cn(
                                                            "flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent hover:text-accent-foreground",
                                                            isSiteExpanded && "bg-accent/40"
                                                        )}
                                                        title={site}
                                                    >
                                                        <ChevronRight
                                                            className={cn(
                                                                "h-4 w-4 transition-transform",
                                                                isSiteExpanded && "rotate-90"
                                                            )}
                                                            aria-hidden="true"
                                                        />
                                                        <span className="truncate">{site}</span>
                                                        <span className="ml-auto rounded bg-muted px-1.5 text-xs text-muted-foreground">
                                                            {count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        </aside>
    );
}
