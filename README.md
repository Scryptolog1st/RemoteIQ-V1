# RemoteIQ V1

RemoteIQ is a full-stack remote monitoring and management (RMM) platform that combines a modular NestJS control plane, a Next.js operator dashboard, and a hardened Windows service agent. The monorepo contains everything required to authenticate operators, enroll devices, dispatch automation, stream telemetry, and apply tenant branding from a single codebase.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L1-L95】【F:remoteiq-frontend/package.json†L1-L71】【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L44】

## Platform overview

- **Backend control plane.** `AppModule` wires feature modules for authentication, agents, jobs, devices, branding, localization, support, SMTP/IMAP, and WebSockets while registering shared storage and maintenance services.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L1-L95】
- **Operational bootstrap.** The Nest bootstrap sequence enables static asset serving, cookie parsing, adaptive CORS, health checks, optional Swagger docs, and a session-heartbeat interceptor that reuses the Postgres pool when available.【F:remoteiq-minimal-e2e/backend/src/main.ts†L1-L136】
- **Identity and session security.** Login flows enforce password validation, two-factor authentication, trusted devices, JWT cookies, and session recording backed by scheduled cleanup of stale entries.【F:remoteiq-minimal-e2e/backend/src/auth/auth.controller.ts†L1-L125】【F:remoteiq-minimal-e2e/backend/src/auth/user-auth.service.ts†L1-L200】【F:remoteiq-minimal-e2e/backend/src/maintenance/session-cleaner.service.ts†L1-L45】
- **Agent and job automation.** Automation services resolve the latest agent for a device, create run-script jobs, and dispatch them through WebSockets while persisting results in SQL tables managed by Prisma.【F:remoteiq-minimal-e2e/backend/src/automation/automation.service.ts†L1-L50】【F:remoteiq-minimal-e2e/backend/src/jobs/jobs.service.ts†L1-L150】【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L53】
- **Realtime execution channel.** The agent WebSocket gateway registers sockets, streams queued jobs to connected agents, and records job outcomes as they arrive.【F:remoteiq-minimal-e2e/backend/src/ws/agent.gateway.ts†L1-L191】
- **Device inventory and health.** Device services merge live agent telemetry with static device rows, while the checks service provisions schemas, ingests agent runs, and exposes normalized statuses for UI consumption.【F:remoteiq-minimal-e2e/backend/src/devices/devices.service.ts†L1-L200】【F:remoteiq-minimal-e2e/backend/src/checks/checks.service.ts†L1-L200】
- **Notifications, branding, and support.** Dedicated services manage SMTP/DKIM profiles, tenant branding assets, and support/legal contact metadata for downstream tooling.【F:remoteiq-minimal-e2e/backend/src/smtp/smtp.service.ts†L1-L200】【F:remoteiq-minimal-e2e/backend/src/branding/branding.service.ts†L1-L139】【F:remoteiq-minimal-e2e/backend/src/support/support.service.ts†L1-L57】
- **Dashboard stack.** The operator UI ships with Next.js 15, React 19 RC, Radix UI primitives, grid layouts, charting, virtualization, and lint/typecheck tooling for a modern web experience.【F:remoteiq-frontend/package.json†L1-L71】
- **Saved views and analytics.** Dashboard context providers persist layouts, filters, and URL-encoded snapshots, while the main dashboard renders KPI cards, drag-and-drop charts, and device distribution widgets.【F:remoteiq-frontend/app/(dashboard)/dashboard-context.tsx†L1-L200】【F:remoteiq-frontend/app/(dashboard)/page.tsx†L1-L200】
- **Typed frontend API.** A centralized client wraps authenticated fetches for devices, checks, software, automation runs, and administrative configuration, paired with hooks that debounce filters and cancel in-flight requests.【F:remoteiq-frontend/lib/api.ts†L1-L240】【F:remoteiq-frontend/lib/use-devices.ts†L1-L169】
- **Brand-aware authentication.** The login route honors tenant theming, enforces safe redirects, remembers trusted devices, and guides operators through TOTP or recovery-based two-factor verification backed by the branding provider.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L1-L200】【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L1-L198】
- **Windows service agent.** The .NET 8 LocalService agent enrolls with the backend, validates signed jobs, stores secrets with DPAPI, emits logs, and supports staged self-updates with centralized package versioning and SDK pinning.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L44】【F:Directory.Packages.props†L1-L14】【F:global.json†L1-L5】

## Architecture

```
+-------------------+      HTTPS/WS       +-------------------------------+
|  Next.js Dashboard| <-----------------> |  NestJS Control Plane         |
|  (operators)      |   REST (/api/*)     |  • Auth, Branding, Support    |
|  • Saved views    |   WS (/ws-ui)       |  • Devices, Jobs, Automation  |
|  • KPI dashboards |                    |  • SMTP/IMAP, Storage         |
+---------^---------+                    +------v---------------^-------+
          |                                    |               |
          | WS updates (/ws-ui)                | WS (/ws)      | SQL
          |                                    v               |
          |                          +-----------------+       |
          |                          | Agent Gateway   |       |
          |                          | • Dispatch jobs |       |
          |                          | • Collect logs  |       |
          |                          +--------+--------+       |
          |                                   |                |
          |                      Signed tasks |                |
          v                                   v                v
+-------------------+                +-----------------+   +---------+
| Windows Service   |  HTTPS/WS      | Automation/Jobs |   | Postgres|
| Agent (.NET)      | <------------> | Prisma tables   |   | / SQLite|
| • Heartbeats      |                | & repositories  |   +---------+
| • Inventory       |                +-----------------+
```

- Dashboard clients authenticate with JWT cookies, open `/ws-ui`, and subscribe to per-device channels that enforce cookie-based verification via `DashboardGateway`.【F:remoteiq-minimal-e2e/backend/src/ws/dashboard.gateway.ts†L1-L200】
- Agents enroll, connect to `/ws`, announce themselves with `agent_hello`, receive queued jobs, and post `job_result` payloads that persist via the jobs service.【F:remoteiq-minimal-e2e/backend/src/ws/agent.gateway.ts†L1-L191】【F:remoteiq-minimal-e2e/backend/src/jobs/jobs.service.ts†L1-L150】
- Automation controllers accept run-script requests, broadcast job status updates, and expose streaming-friendly job logs for the UI.【F:remoteiq-minimal-e2e/backend/src/automation/automation.controller.ts†L1-L77】

## Component reference

### Backend (NestJS control plane)

| Area | Responsibilities |
| ---- | ---------------- |
| Authentication | Controllers and services for login, 2FA verification, trusted devices, session cookies, and `/api/auth/me` checks.【F:remoteiq-minimal-e2e/backend/src/auth/auth.controller.ts†L1-L125】【F:remoteiq-minimal-e2e/backend/src/auth/user-auth.service.ts†L1-L200】 |
| Agents & Jobs | Agent enrollment, job queuing, dispatch, and result persistence through automation services, WebSocket gateways, and SQL-backed repositories.【F:remoteiq-minimal-e2e/backend/src/automation/automation.service.ts†L1-L50】【F:remoteiq-minimal-e2e/backend/src/ws/agent.gateway.ts†L1-L191】【F:remoteiq-minimal-e2e/backend/src/jobs/jobs.service.ts†L1-L150】 |
| Device telemetry | List and fetch devices by merging `agents` and `devices` tables, plus ingest and normalize health checks for dashboards.【F:remoteiq-minimal-e2e/backend/src/devices/devices.service.ts†L1-L200】【F:remoteiq-minimal-e2e/backend/src/checks/checks.service.ts†L1-L200】 |
| Communications | SMTP profiles with DKIM management, IMAP readiness, and support/legal metadata APIs for tenant operators.【F:remoteiq-minimal-e2e/backend/src/smtp/smtp.service.ts†L1-L200】【F:remoteiq-minimal-e2e/backend/src/support/support.service.ts†L1-L57】 |
| Branding | Persist and serve tenant branding (colors, logos, login backgrounds, email chrome, CSS) with SSL-aware Postgres connections.【F:remoteiq-minimal-e2e/backend/src/branding/branding.service.ts†L1-L139】 |
| Realtime UI | WebSocket registry for dashboard sockets, supporting device subscriptions, ping/pong heartbeats, and subscriber counts.【F:remoteiq-minimal-e2e/backend/src/ws/dashboard.gateway.ts†L1-L200】 |
| Storage & maintenance | Pg pool lifecycle management, environment-driven configuration, and scheduled pruning of revoked sessions.【F:remoteiq-minimal-e2e/backend/src/storage/pg-pool.service.ts†L1-L106】【F:remoteiq-minimal-e2e/backend/src/maintenance/session-cleaner.service.ts†L1-L45】 |

**Key data stores.** Prisma defines `Agent`, `Job`, and `JobResult` tables for automation, while raw SQL modules manage checks, support data, and SMTP credentials.【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L53】【F:remoteiq-minimal-e2e/backend/src/checks/checks.service.ts†L1-L200】【F:remoteiq-minimal-e2e/backend/src/smtp/smtp.service.ts†L1-L200】

**Configuration.** Default configuration targets SQLite for local development, supports Dockerized Postgres, and exposes JSON mappings for multi-database deployments.【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】【F:remoteiq-minimal-e2e/backend/docker-compose.db.yml†L1-L51】【F:remoteiq-minimal-e2e/backend/config/database.json†L1-L23】

### Frontend (Next.js dashboard)

- **Tech stack.** The app uses Next.js 15 with React 19 RC, Radix UI, Tailwind CSS, drag-and-drop, virtualization, charting, and database client SDKs for external integrations.【F:remoteiq-frontend/package.json†L1-L71】
- **State & saved views.** `dashboard-context` persists grid layouts, table state, hierarchy expansion, and URL-encoded snapshots while coordinating device filters and alias storage in localStorage.【F:remoteiq-frontend/app/(dashboard)/dashboard-context.tsx†L1-L200】
- **Dashboards & analytics.** The main dashboard renders KPI cards, donut/stacked charts, and drag-and-drop layouts backed by React Grid Layout and Recharts datasets derived from current devices.【F:remoteiq-frontend/app/(dashboard)/page.tsx†L1-L200】
- **Device browsing & automation.** Hooks debounce search criteria, page through cursor-based results, and expose helpers to refresh, load more, or reset state, while the API client offers typed access to devices, checks, automation runs, and administrative endpoints.【F:remoteiq-frontend/lib/use-devices.ts†L1-L169】【F:remoteiq-frontend/lib/api.ts†L1-L240】
- **Authentication & branding.** The login flow implements remembered email, safe redirects, 2FA challenges, and recovery codes, while the branding provider fetches `/api/branding`, applies CSS variables, updates favicons, and supports preview/clear APIs for admin tooling.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L1-L200】【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L1-L198】

### Windows agent (.NET service)

- **Runtime.** Built against the repo-wide .NET 8 SDK (`8.0.415`) with centrally managed package versions for hosting, HTTP, logging, and Windows service helpers.【F:global.json†L1-L5】【F:Directory.Packages.props†L1-L14】
- **Capabilities.** The LocalService-hosted agent enrolls with the backend, posts heartbeats and inventory, executes RSA-PSS-signed tasks, uploads artifacts, protects secrets with DPAPI, supports TLS pinning, and stages self-updates through scripted installers.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L44】
- **Operations.** `dotnet publish -c Release -r win-x64` produces distributable binaries, while PowerShell scripts install/uninstall the Windows service and persist configuration/logs under `%ProgramData%/RemoteIQ`.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L5-L33】

## Repository layout

| Path | Description |
| ---- | ----------- |
| `remoteiq-minimal-e2e/backend/` | NestJS API source, Prisma schema, Docker assets, and configuration modules for authentication, devices, automation, branding, support, and messaging.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L1-L95】【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L53】 |
| `remoteiq-frontend/` | Next.js app router, dashboard views, providers, typed API client, hooks, Tailwind styling, and component library definitions.【F:remoteiq-frontend/package.json†L1-L71】【F:remoteiq-frontend/app/(dashboard)/page.tsx†L1-L200】 |
| `remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/` | Windows service agent source, packaging scripts, and deployment guidance for managed endpoints.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L44】 |
| `Directory.Packages.props` | Central NuGet package management for all bundled .NET projects.【F:Directory.Packages.props†L1-L14】 |
| `remoteiq_export.txt` | Context export containing backend configuration samples and reference environment notes for operators.【F:remoteiq_export.txt†L1-L19】 |
| `riq-support.txt` | Support bundle highlighting agent/system metadata for troubleshooting playbooks.【F:riq-support.txt†L1-L19】 |

## Operational data flows

### User sign-in and session hygiene

1. Operators post credentials to `/api/auth/login`, receive 2FA challenges when required, and set HTTP-only JWT cookies when verification succeeds.【F:remoteiq-minimal-e2e/backend/src/auth/auth.controller.ts†L1-L125】
2. `UserAuthService` validates passwords against Postgres, tracks trusted devices, manages challenge tokens, and records session metadata (user agent, IP, expiry).【F:remoteiq-minimal-e2e/backend/src/auth/user-auth.service.ts†L1-L200】
3. `SessionHeartbeatInterceptor` (enabled during bootstrap) refreshes session timestamps, while `SessionCleanerService` prunes revoked sessions older than 30 days.【F:remoteiq-minimal-e2e/backend/src/main.ts†L115-L136】【F:remoteiq-minimal-e2e/backend/src/maintenance/session-cleaner.service.ts†L1-L45】

### Agent enrollment and job lifecycle

1. Automation requests identify the latest agent for a device and create queued run-script jobs with payloads persisted in SQL.【F:remoteiq-minimal-e2e/backend/src/automation/automation.service.ts†L1-L50】【F:remoteiq-minimal-e2e/backend/src/jobs/jobs.service.ts†L45-L86】
2. When agents connect to `/ws` and send `agent_hello`, the gateway registers sockets and immediately dispatches queued jobs; job results trigger persistence and status broadcasts.【F:remoteiq-minimal-e2e/backend/src/ws/agent.gateway.ts†L67-L147】
3. Dashboard clients poll or subscribe to job snapshots via automation endpoints that stream log updates for operator visibility.【F:remoteiq-minimal-e2e/backend/src/automation/automation.controller.ts†L27-L77】【F:remoteiq-frontend/lib/api.ts†L163-L199】

### Dashboard telemetry and saved views

1. The device service merges live agent data with static inventory and exposes cursor-based pagination filtered by status, OS, or search term.【F:remoteiq-minimal-e2e/backend/src/devices/devices.service.ts†L33-L139】
2. Frontend hooks debounce filters, cancel in-flight requests, and manage paging state to keep tables responsive.【F:remoteiq-frontend/lib/use-devices.ts†L18-L169】
3. Saved views serialize table visibility, hierarchy expansion, and dashboard layouts into localStorage and base64-encoded URLs, enabling easy operator sharing.【F:remoteiq-frontend/app/(dashboard)/dashboard-context.tsx†L60-L183】
4. Dashboard sockets authenticate with cookies, acknowledge subscriptions, and keep per-device telemetry in sync through ping/pong heartbeats.【F:remoteiq-minimal-e2e/backend/src/ws/dashboard.gateway.ts†L51-L200】

## Environment setup

### Backend API (NestJS)

1. Install dependencies inside `remoteiq-minimal-e2e/backend/` using your preferred Node manager (PNPM metadata is provided in the workspace).【F:remoteiq-minimal-e2e/backend/package.json†L1-L68】
2. Copy `.env.example` to `.env` and populate `DATABASE_URL`, enrollment secrets, admin API keys, and JWT secrets for your environment.【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】
3. Choose a datasource:
   - Use the default SQLite connection for quick prototyping via Prisma’s bundled schema.【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L32】
   - Or start the Docker Postgres + pgAdmin stack and point `DATABASE_URL` (or `config/database.json`) to the exposed container credentials.【F:remoteiq-minimal-e2e/backend/docker-compose.db.yml†L1-L51】【F:remoteiq-minimal-e2e/backend/config/database.json†L1-L23】
4. Generate Prisma client code and run migrations: `pnpm prisma:generate && pnpm prisma:migrate:dev` (see package scripts).【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】
5. Launch the API with `pnpm dev`; Swagger mounts on `/docs` when enabled, `/healthz` reports service readiness, and static assets serve under `/static/*`.【F:remoteiq-minimal-e2e/backend/src/main.ts†L83-L136】

### Web dashboard (Next.js)

1. Install dependencies in `remoteiq-frontend/` (`pnpm install`, `npm install`, or `yarn`).【F:remoteiq-frontend/package.json†L1-L11】
2. Configure `.env.local` (or hosting secrets) with `NEXT_PUBLIC_API_BASE` and matching WebSocket origins for `/ws-ui` connections.【F:remoteiq-frontend/lib/api.ts†L1-L24】【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L121-L156】
3. Run `pnpm dev` (or `npm run dev`) to start the Next.js app router with hot reloading, Tailwind, and lint/typecheck integrations.【F:remoteiq-frontend/package.json†L5-L11】
4. Navigate to `http://localhost:3000` to access the branded login flow with 2FA, remembered devices, and secure post-login redirects.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L21-L200】

### Windows service agent

1. Install the .NET SDK specified in `global.json` (`8.0.415`).【F:global.json†L1-L5】
2. From `remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/`, run `dotnet publish -c Release -r win-x64` to produce self-contained binaries.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L5-L12】
3. Deploy with `scripts/install-agent.ps1`, providing your API base URL and agent group; configuration and logs live under `%ProgramData%/RemoteIQ`.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L14-L33】
4. Use the documented REST contract to verify enroll, heartbeat, inventory, job dispatch, completion, and update flows before production rollout.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L35-L44】

## Development and testing

- **Backend scripts.** `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm prisma:*`, and `pnpm health` support iterative development, compilation, database management, and health checks.【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】
- **Frontend scripts.** `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, and `pnpm typecheck` cover the Next.js lifecycle and quality gates.【F:remoteiq-frontend/package.json†L5-L11】
- **Agent build.** `dotnet publish -c Release -r win-x64` emits production binaries signed according to your configured key material.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L5-L33】
- **Health probe.** Run `pnpm health` in the backend to assert `/healthz` availability during local development or CI.【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】

## Supporting resources

- `remoteiq_export.txt` captures representative backend environment settings, making it a quick reference when populating `.env` or onboarding new operators.【F:remoteiq_export.txt†L1-L19】
- `riq-support.txt` summarizes platform support expectations, system metadata, and agent footprints for compliance and troubleshooting playbooks.【F:riq-support.txt†L1-L19】

RemoteIQ V1 consolidates backend orchestration, operator workflows, and endpoint automation into a single repository so that teams can manage remote fleets, enforce branding, and automate remediation with minimal glue code.
