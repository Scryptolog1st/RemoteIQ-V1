// app/(dashboard)/page.tsx
"use client";

import * as React from "react";
import { useDashboard } from "@/app/(dashboard)/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, SlidersHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Responsive as ResponsiveGrid,
  WidthProvider,
  type Layouts,
  type Layout,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

/* ----------------------------- helpers / colors ---------------------------- */
type DonutDatum = { name: string; value: number };
type ClientDatum = { name: string; value: number };
type HeatRow = { os: string; Healthy: number; Warning: number; Critical: number; Offline: number };

const STATUS_KEYS = ["Healthy", "Warning", "Critical", "Offline"] as const;
const OS_KEYS = ["Windows", "Linux", "macOS"] as const;

const HUES = {
  Healthy: "hsl(151 55% 41%)",
  Warning: "hsl(37 92% 50%)",
  Critical: "hsl(0 84% 60%)",
  Offline: "hsl(215 20% 65%)",
  Windows: "hsl(226 70% 55%)",
  Linux: "hsl(173 80% 40%)",
  macOS: "hsl(258 90% 66%)",
} as const;

function norm(s: string | unknown) {
  const t = String(s || "").toLowerCase();
  if (t === "healthy") return "Healthy";
  if (t === "warning") return "Warning";
  if (t === "critical") return "Critical";
  return "Offline";
}
function countBy<T, K extends string>(arr: T[], keyFn: (x: T) => K): Record<K, number> {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<K, number>);
}
function pickPalette(i: number) {
  const palette = [
    "hsl(210 80% 60%)",
    "hsl(275 80% 70%)",
    "hsl(160 75% 45%)",
    "hsl(20 85% 60%)",
    "hsl(335 75% 60%)",
    "hsl(45 90% 55%)",
    "hsl(190 80% 55%)",
    "hsl(125 60% 40%)",
  ];
  return palette[i % palette.length];
}
function buildClientSiteMatrix(devices: { client: string; site: string }[]) {
  const byClient: Record<string, Record<string, number>> = {};
  for (const d of devices) {
    byClient[d.client] ??= {};
    byClient[d.client][d.site] = (byClient[d.client][d.site] ?? 0) + 1;
  }
  return Object.entries(byClient).map(([client, sites]) => ({ client, ...sites }));
}
function uniqueSites(devices: { site: string }[]) {
  return Array.from(new Set(devices.map((d) => d.site)));
}

/* --------------------------------- cards ---------------------------------- */
function KpiCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="relative h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            title="Move"
            className="move-handle h-6 w-6 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="text-2xl font-semibold leading-none">{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="relative h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            title="Move"
            className="move-handle h-6 w-6 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 grow min-h-0">
        <div className="h-full">{children}</div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- page ----------------------------------- */
const RGL = WidthProvider(ResponsiveGrid);

// Grid rhythm: SMALL = 1 unit; LARGE = 3 units.
const rowHeight = 12;
const SMALL = 8; // 1 small unit
const LARGE = SMALL * 3; // 3 small units

// Card catalog (for Customize menu + layout filtering)
const CARD_CATALOG: { key: string; label: string }[] = [
  { key: "kpi-healthy", label: "KPI: Healthy" },
  { key: "kpi-critical", label: "KPI: Critical" },
  { key: "kpi-warning", label: "KPI: Warning" },
  { key: "kpi-total", label: "KPI: Total Endpoints" },
  { key: "donut-os", label: "OS Distribution" },
  { key: "heat-status-os", label: "Status × OS Heatmap" },
  { key: "stack-client-sites", label: "Clients → Sites (Stacked)" },
  { key: "donut-client", label: "Endpoints by Client" },
  { key: "table-offline", label: "Offline > 24h" },
  { key: "donut-status", label: "Status Distribution" },
];

export default function DashboardPage() {
  const {
    masterDevices,

    // dashboard state in context (persisted by Saved Views / URL)
    dashboardHidden,
    setDashboardHidden,
    dashboardLayouts,
    setDashboardLayouts,
    setDashboardOrder, // we'll derive an order and keep it in context
    registerSnapshotGetter, // so Saved Views capture layouts/hidden/order
  } = useDashboard();

  // KPIs
  const totals = React.useMemo(() => {
    const total = masterDevices.length;
    const byStatus = countBy(masterDevices, (d: any) => norm(d.status));
    return {
      total,
      healthy: byStatus.Healthy ?? 0,
      critical: byStatus.Critical ?? 0,
      warning: byStatus.Warning ?? 0,
    };
  }, [masterDevices]);

  // Chart data
  const statusData: DonutDatum[] = React.useMemo(() => {
    const byStatus = countBy(masterDevices, (d: any) => norm(d.status));
    return STATUS_KEYS.map((k) => ({ name: k, value: byStatus[k] ?? 0 }));
  }, [masterDevices]);

  const osData: DonutDatum[] = React.useMemo(() => {
    const byOs = countBy(masterDevices, (d: any) => d.os);
    return OS_KEYS.map((k) => ({ name: k, value: byOs[k] ?? 0 }));
  }, [masterDevices]);

  const clientsDonut: ClientDatum[] = React.useMemo(() => {
    const byClient = countBy(masterDevices, (d: any) => d.client);
    return Object.entries(byClient).map(([name, value]) => ({ name, value }));
  }, [masterDevices]);

  const heatRows: HeatRow[] = React.useMemo(() => {
    return OS_KEYS.map((os) => {
      const subset = masterDevices.filter((d: any) => d.os === os);
      const byStatus = countBy(subset, (d: any) => norm(d.status));
      return {
        os,
        Healthy: byStatus.Healthy ?? 0,
        Warning: byStatus.Warning ?? 0,
        Critical: byStatus.Critical ?? 0,
        Offline: byStatus.Offline ?? 0,
      };
    });
  }, [masterDevices]);

  const offlineOver24 = React.useMemo(() => {
    return masterDevices
      .filter((d: any) => norm(d.status) === "Offline")
      .map((d: any) => ({
        id: d.id,
        hostname: d.alias || d.hostname,
        client: d.client,
        site: d.site,
        lastResponse: d.lastResponse,
      }));
  }, [masterDevices]);

  /* -------------------------- react-grid-layout setup ----------------------- */
  // All breakpoints, derived from a local base LG, computed once (no dangling deps)
  const initialLayouts: Layouts = React.useMemo(() => {
    const baseLg: Layout[] = [
      // Row 1 (all SMALL)
      { i: "kpi-healthy", x: 0, y: 0, w: 3, h: SMALL },
      { i: "kpi-critical", x: 3, y: 0, w: 3, h: SMALL },
      { i: "kpi-warning", x: 6, y: 0, w: 3, h: SMALL },
      { i: "kpi-total", x: 9, y: 0, w: 3, h: SMALL },

      // Row 2 (all LARGE, start at y = SMALL)
      { i: "donut-os", x: 0, y: SMALL, w: 6, h: LARGE },
      { i: "heat-status-os", x: 6, y: SMALL, w: 6, h: LARGE },

      // Row 3 (all LARGE, start at y = SMALL + LARGE = 4*SMALL)
      { i: "stack-client-sites", x: 0, y: SMALL + LARGE, w: 6, h: LARGE },
      { i: "donut-client", x: 6, y: SMALL + LARGE, w: 6, h: LARGE },

      // Row 4 (all LARGE)
      { i: "table-offline", x: 0, y: SMALL + LARGE * 2, w: 6, h: LARGE },
      { i: "donut-status", x: 6, y: SMALL + LARGE * 2, w: 6, h: LARGE },
    ];

    return {
      lg: baseLg,
      md: baseLg.map((l) => ({
        ...l,
        w: Math.min(10, l.w),
        x: Math.min(l.x, 10 - Math.min(10, l.w)),
      })),
      sm: baseLg.map((l) => ({ ...l, w: Math.min(8, l.w), x: 0 })),
      xs: baseLg.map((l) => ({ ...l, w: Math.min(6, l.w), x: 0 })),
      xxs: baseLg.map((l) => ({ ...l, w: Math.min(4, l.w), x: 0 })),
    };
  }, []);

  // Local state mirrors context.dashboardLayouts (for RGL controlled mode)
  const [allLayouts, setAllLayouts] = React.useState<Layouts>(initialLayouts);

  // On mount / when payload loads a view: sync local state from context
  React.useEffect(() => {
    if (dashboardLayouts && Object.keys(dashboardLayouts).length) {
      setAllLayouts(dashboardLayouts);
    } else {
      // if nothing saved yet, ensure context has our initial layout
      setDashboardLayouts(initialLayouts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardLayouts]);

  // Visible keys / hidden handling
  const isHidden = React.useCallback(
    (key: string) => dashboardHidden.includes(key),
    [dashboardHidden]
  );
  const visibleKeys = React.useMemo(
    () => new Set(CARD_CATALOG.map((c) => c.key).filter((k) => !isHidden(k))),
    [isHidden]
  );

  // Filter layouts to only visible items (so RGL doesn’t render holes)
  const visibleLayouts = React.useMemo<Layouts>(() => {
    const out: Layouts = {};
    (["lg", "md", "sm", "xs", "xxs"] as const).forEach((bp) => {
      out[bp] = (allLayouts[bp] ?? []).filter((l) => visibleKeys.has(l.i));
    });
    return out;
  }, [allLayouts, visibleKeys]);

  // Helper: derive a stable order from the LG layout (sort by y then x)
  const deriveOrder = React.useCallback((lg: Layout[]) => {
    return [...lg].sort((a, b) => a.y - b.y || a.x - b.x).map((l) => l.i);
  }, []);

  // Merge updates from RGL (visible items) back into the full layout (keeps hidden positions)
  const onLayoutChange = (_: Layout[], updatedVisible: Layouts) => {
    const merged: Layouts = {};
    (["lg", "md", "sm", "xs", "xxs"] as const).forEach((bp) => {
      const old = allLayouts[bp] ?? [];
      const vis = updatedVisible[bp] ?? [];
      const hidden = old.filter((l) => !visibleKeys.has(l.i));
      merged[bp] = [...vis, ...hidden];
    });
    setAllLayouts(merged);
    setDashboardLayouts(merged);
    // keep a readable order in context too (from LG)
    setDashboardOrder(deriveOrder(merged.lg ?? []));
  };

  // Customize menu helpers
  const setHidden = React.useCallback(
    (key: string, hidden: boolean) => {
      setDashboardHidden((prev) =>
        hidden ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key)
      );
    },
    [setDashboardHidden]
  );

  const visibleCount = CARD_CATALOG.length - dashboardHidden.length;
  const allVisible = visibleCount === CARD_CATALOG.length;
  const noneVisible = visibleCount === 0;

  const selectAll = React.useCallback(() => setDashboardHidden([]), [setDashboardHidden]);
  const clearAll = React.useCallback(
    () => setDashboardHidden(CARD_CATALOG.map((c) => c.key)),
    [setDashboardHidden]
  );

  // ✅ Register a snapshot getter so Saved Views capture layouts + hidden + order
  React.useEffect(() => {
    registerSnapshotGetter?.(() => ({
      // table state not on this page; only dashboard bits matter
      columnVisibility: {},
      sorting: [],
      columnFilters: [],

      dashboardOrder: deriveOrder((dashboardLayouts?.lg ?? allLayouts.lg) ?? []),
      dashboardLayouts: dashboardLayouts ?? allLayouts,
      dashboardHidden,
    }));

    return () => registerSnapshotGetter?.(null);
  }, [registerSnapshotGetter, dashboardHidden, dashboardLayouts, allLayouts, deriveOrder]);

  // helpers
  const KPI = (title: string, value: number | string) => <KpiCard title={title} value={value} />;

  const Donut = (title: string, data: DonutDatum[]) => (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="80%"
            stroke="hsl(var(--card))"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={(HUES as any)[d.name] ?? pickPalette(i)} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={24} />
          <RTooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );

  const Heat = () => (
    <ChartCard title="Status × OS Heatmap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={heatRows} margin={{ left: 16, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="os" />
          <YAxis allowDecimals={false} />
          <Legend />
          <RTooltip />
          <Bar dataKey="Critical" stackId="s" fill={HUES.Critical} />
          <Bar dataKey="Warning" stackId="s" fill={HUES.Warning} />
          <Bar dataKey="Healthy" stackId="s" fill={HUES.Healthy} />
          <Bar dataKey="Offline" stackId="s" fill={HUES.Offline} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );

  const Stacked = () => (
    <ChartCard title="Clients → Sites (Stacked)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buildClientSiteMatrix(masterDevices as any)}
          stackOffset="expand"
          margin={{ left: 16, right: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="client" />
          <YAxis tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} />
          <Legend />
          <RTooltip />
          {uniqueSites(masterDevices as any).map((site, i) => (
            <Bar key={site} dataKey={site} stackId="a" fill={pickPalette(i)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );

  const OfflineTable = () => (
    <ChartCard title="Offline > 24h">
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-left font-medium">Hostname</th>
              <th className="py-2 text-left font-medium">Client</th>
              <th className="py-2 text-left font-medium">Site</th>
              <th className="py-2 text-left font-medium">Last Response</th>
            </tr>
          </thead>
          <tbody>
            {offlineOver24.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-muted-foreground" colSpan={4}>
                  No offline endpoints over 24h 🎉
                </td>
              </tr>
            ) : (
              offlineOver24.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{r.hostname}</td>
                  <td className="py-2">{r.client}</td>
                  <td className="py-2">{r.site}</td>
                  <td className="py-2">{r.lastResponse}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );

  /* --------------------------------- render --------------------------------- */
  return (
    <main className="p-4 sm:p-6">
      {/* Quick filters + Customize */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Quick Filters</span>
          <span className="rounded-full bg-secondary px-2 py-1">Healthy</span>
          <span className="rounded-full bg-secondary px-2 py-1">Warning</span>
          <span className="rounded-full bg-secondary px-2 py-1">Critical</span>
          <span className="rounded-full bg-secondary px-2 py-1">Offline</span>
          <span className="rounded-full bg-secondary px-2 py-1">Windows</span>
          <span className="rounded-full bg-secondary px-2 py-1">Linux</span>
          <span className="rounded-full bg-secondary px-2 py-1">macOS</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" title="Show or hide dashboard cards">
              <SlidersHorizontal className="h-4 w-4" />
              Customize
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              Cards ({CARD_CATALOG.length - dashboardHidden.length}/{CARD_CATALOG.length})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CARD_CATALOG.map(({ key, label }) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={!isHidden(key)}
                onCheckedChange={(checked) => setHidden(key, !checked)}
                className="truncate"
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                selectAll();
              }}
              disabled={allVisible}
            >
              Show all
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                clearAll();
              }}
              disabled={noneVisible}
            >
              Hide all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RGL
        className="layout"
        layouts={visibleLayouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 560, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 8, xs: 6, xxs: 4 }}
        rowHeight={rowHeight}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        draggableHandle=".move-handle"
        onLayoutChange={onLayoutChange}
        compactType="vertical"
      >
        {/* Row 1: SMALL */}
        {!isHidden("kpi-healthy") && (
          <div key="kpi-healthy" className="h-full">
            {KPI("Healthy", totals.healthy)}
          </div>
        )}
        {!isHidden("kpi-critical") && (
          <div key="kpi-critical" className="h-full">
            {KPI("Critical", totals.critical)}
          </div>
        )}
        {!isHidden("kpi-warning") && (
          <div key="kpi-warning" className="h-full">
            {KPI("Warning", totals.warning)}
          </div>
        )}
        {!isHidden("kpi-total") && (
          <div key="kpi-total" className="h-full">
            {KPI("Total Endpoints", totals.total)}
          </div>
        )}

        {/* Row 2: LARGE */}
        {!isHidden("donut-os") && (
          <div key="donut-os" className="h-full">
            {Donut("OS Distribution", osData)}
          </div>
        )}
        {!isHidden("heat-status-os") && (
          <div key="heat-status-os" className="h-full">
            {Heat()}
          </div>
        )}

        {/* Row 3: LARGE */}
        {!isHidden("stack-client-sites") && (
          <div key="stack-client-sites" className="h-full">
            {Stacked()}
          </div>
        )}
        {!isHidden("donut-client") && (
          <div key="donut-client" className="h-full">
            {Donut("Endpoints by Client", clientsDonut)}
          </div>
        )}

        {/* Row 4: LARGE */}
        {!isHidden("table-offline") && (
          <div key="table-offline" className="h-full">
            {OfflineTable()}
          </div>
        )}
        {!isHidden("donut-status") && (
          <div key="donut-status" className="h-full">
            {Donut("Status Distribution", statusData)}
          </div>
        )}
      </RGL>
    </main>
  );
}
