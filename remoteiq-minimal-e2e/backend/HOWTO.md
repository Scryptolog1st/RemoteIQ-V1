# HOWTO — Wire Backend Endpoints to Frontend

> Assumes dev on `http://localhost:3001` and your Next.js app calls `/api/*` endpoints.

## Health
- **Endpoint**: `GET /healthz`
- **Behavior**: returns `{ ok: true, service: "remoteiq-backend", time: ISO }` with 200

## Devices List
Maps *Agents* table to the frontend “devices” grid.

- **Endpoint**: `GET /api/devices`
- **Query params**:
  - `pageSize` (default 25, max 200)
  - `cursor` (opaque, returned from previous page)
  - `status`: `online` | `offline` (optional)
  - `os`: repeatable like `os=windows&os=linux` (optional)
  - `q`: hostname contains search (optional)

- **Response**:
```json
{
  "items": [{
    "id": "uuid",
    "hostname": "DESKTOP-123",
    "os": "windows",
    "arch": "x64",
    "lastSeen": "2025-10-18T15:20:00Z",
    "status": "online" | "offline"
  }],
  "nextCursor": "opaque-or-null",
  "total": null // omitted for O(1); add if you later implement count cache
}
```

- **Mapping**:
  - `status` is computed: online if `now - lastHeartbeatAt < 30s` (see `isAgentOnline`).

## Frontend Calls
- Customers/org/site filters: if you don’t have multi‑tenancy yet, keep it no‑op for now.
- Saved Views: remains frontend‑only (localStorage + `?v=`). No backend change required.

