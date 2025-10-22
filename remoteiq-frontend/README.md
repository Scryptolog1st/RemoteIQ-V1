# RemoteIQ Frontend Link‑Up Pack (Non-Destructive)

This pack *adds* a few small files to wire your existing components to the backend you’re running on :3001.
It **does not modify** your current files — you can adopt it incrementally.

## What’s included
- `lib/api.ts` — tiny REST client for `/healthz` and `/api/devices`
- `lib/use-devices.ts` — hook that adapts your UI filters to backend params and does cursor pagination
- `lib/ws.ts` — optional bootstrap for WebSocket path `/ws`
- `components/device-table-container.tsx` — wrapper that feeds your existing `DataTable` the fetched rows

## Quick start
1) Create/update **.env.local** in the frontend root:
   ```bash
   NEXT_PUBLIC_API_BASE=http://localhost:3001
   NEXT_PUBLIC_WS_BASE=ws://localhost:3001/ws
   ```

2) Copy the `lib/` and `components/` files from this pack into your project.

3) Wherever you render the devices grid, swap your current table component for:
   ```tsx
   import DeviceTableContainer from "@/components/device-table-container";
   // ...
   <DeviceTableContainer />
   ```

   *This leaves your `DataTable`, `device-table`, `filters-rail`, and styling untouched.*

4) Verify:
   - Dashboard shows devices from backend (status/OS/q filters applied)
   - "Load more" button appears when more pages exist
   - Health check: optional snippet in README of backend pack

## Notes
- Status mapping is temporary: Healthy/Warning/Critical → `online`, Offline → `offline` until backend exposes granular health.
- When you’re ready, I’ll ship `GET /api/devices/:id` and the Run Script flow (POST + WS).
