# RemoteIQ V1

RemoteIQ is an end-to-end remote monitoring and management (RMM) platform that combines a modular NestJS control plane, a customizable Next.js operator dashboard, and production-ready Windows service agents for field devices. The monorepo bundles everything required to enroll endpoints, dispatch jobs, stream telemetry, apply tenant branding, and operate multi-tenant support workflows.

## Table of contents

- [Architecture overview](#architecture-overview)
- [Repository layout](#repository-layout)
- [Backend platform capabilities](#backend-platform-capabilities)
  - [Identity and session security](#identity-and-session-security)
  - [Agent orchestration and job automation](#agent-orchestration-and-job-automation)
  - [Operations, notifications, and integrations](#operations-notifications-and-integrations)
  - [Branding and customer communications](#branding-and-customer-communications)
  - [Realtime streaming](#realtime-streaming)
  - [Storage and configuration services](#storage-and-configuration-services)
- [Dashboard capabilities](#dashboard-capabilities)
  - [Technology stack](#technology-stack)
  - [Dashboards and analytics](#dashboards-and-analytics)
  - [Saved views, filters, and hierarchy](#saved-views-filters-and-hierarchy)
  - [Device workspace](#device-workspace)
  - [Branding-aware login experience](#branding-aware-login-experience)
  - [Typed API client and automation hooks](#typed-api-client-and-automation-hooks)
- [Windows agent capabilities](#windows-agent-capabilities)
- [Operational workflows](#operational-workflows)
  - [Provisioning and authentication](#provisioning-and-authentication)
  - [Agent enrollment and job lifecycle](#agent-enrollment-and-job-lifecycle)
  - [Run-script automation](#run-script-automation)
  - [Branding and support setup](#branding-and-support-setup)
- [Getting started](#getting-started)
  - [Backend API (NestJS)](#backend-api-nestjs)
  - [Web dashboard (Next.js)](#web-dashboard-nextjs)
  - [Windows service agent](#windows-service-agent)
- [Configuration reference](#configuration-reference)
- [Development and testing](#development-and-testing)
- [Resources](#resources)

## Architecture overview

The control plane is implemented in NestJS with feature modules for authentication, agents, jobs, devices, branding, localization, SMTP/IMAP, and scheduled maintenance, all composed in `AppModule` and guarded by cookie/JWT middleware.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L3-L95】 The bootstrap routine enables Swagger on demand, applies cookie parsing and CORS, serves static assets, registers WebSocket adapters, and wires an interceptor that records session heartbeats whenever the backing PostgreSQL pool is reachable.【F:remoteiq-minimal-e2e/backend/src/main.ts†L1-L136】

The dashboard is a Next.js 15 application that ships with React 19, Radix UI primitives, grid-based layouts, TanStack utilities, Tailwind CSS, Recharts visualizations, and supporting libraries for virtualization, drag-and-drop, and theming.【F:remoteiq-frontend/package.json†L1-L71】

Endpoint visibility and job execution are powered by a hardened .NET 8 Windows service agent that enrolls with the backend, posts heartbeats and inventory, executes signed jobs, persists secrets with DPAPI, and supports staged self-updates with install/uninstall scripts for administrators.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L51】

## Repository layout

| Path | Description |
| ---- | ----------- |
| `remoteiq-minimal-e2e/backend/` | NestJS control plane with REST, WebSocket, SMTP/IMAP, branding, localization, maintenance, and storage modules plus Docker assets for local databases.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L3-L95】 |
| `remoteiq-frontend/` | Next.js dashboard including app router routes, shared UI primitives, branding provider, device dashboards, saved-view state, and API client utilities.【F:remoteiq-frontend/package.json†L1-L71】【F:remoteiq-frontend/app/(dashboard)/dashboard-context.tsx†L1-L200】 |
| `remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/` | Windows agent source, PowerShell packaging scripts, and security guidance for deploying managed endpoints.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L51】 |
| `Directory.Packages.props` | Centralized NuGet version management for .NET projects bundled with the agent.【F:Directory.Packages.props†L1-L14】 |
| `package.json` | Shared Node workspace dependencies and scripts at the repository root. |

## Backend platform capabilities

### Identity and session security

- Login endpoints validate credentials, enforce device-aware two-factor authentication, issue signed JWT cookies, record session metadata, and support trusted devices and logout flows.【F:remoteiq-minimal-e2e/backend/src/auth/auth.controller.ts†L3-L125】
- A global session-heartbeat interceptor is attached during bootstrap to keep session metadata fresh when the storage pool is available.【F:remoteiq-minimal-e2e/backend/src/main.ts†L15-L131】
- Scheduled maintenance jobs prune revoked sessions older than 30 days to reduce stale state.【F:remoteiq-minimal-e2e/backend/src/maintenance/session-cleaner.service.ts†L1-L45】

### Agent orchestration and job automation

- The automation service locates the most recent agent for a device and queues run-script jobs with timeout, shell, and payload metadata backed by Prisma tables.【F:remoteiq-minimal-e2e/backend/src/automation/automation.service.ts†L1-L50】
- Dispatcher services load queued jobs, validate payloads, and push execution envelopes over agent WebSockets while handling retries and error states.【F:remoteiq-minimal-e2e/backend/src/jobs/dispatcher.service.ts†L1-L112】
- Agent WebSocket gateways register device sockets, hydrate identifiers, dispatch queued work on connect, and accept job result callbacks to mark outcomes and persist logs.【F:remoteiq-minimal-e2e/backend/src/ws/agent.gateway.ts†L1-L190】

### Operations, notifications, and integrations

- SMTP services persist per-purpose mail profiles (alerts, billing, etc.), attach DKIM keys from the database or environment, enforce TLS preferences, and expose configuration APIs for outbound notifications.【F:remoteiq-minimal-e2e/backend/src/smtp/smtp.service.ts†L1-L200】
- IMAP intake, alerting, and notification modules are scaffolded for future implementation and already wired into the Nest module graph for expansion.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L21-L74】

### Branding and customer communications

- Branding services read and upsert tenant theming (primary/secondary colors, logos, login backgrounds, favicon, email HTML, CSS overrides) while supporting SSL-aware Postgres connections and conflict-safe writes.【F:remoteiq-minimal-e2e/backend/src/branding/branding.service.ts†L1-L139】
- Support/legal services centralize links for support portals, status pages, legal documents, and contact channels with upsert semantics for administrative tooling.【F:remoteiq-minimal-e2e/backend/src/support/support.service.ts†L1-L57】

### Realtime streaming

- Dashboard WebSocket gateways authenticate via JWT cookies, register sockets, manage per-device subscriptions, and serve heartbeat/pong messages to keep UI tiles synchronized with backend events.【F:remoteiq-minimal-e2e/backend/src/ws/dashboard.gateway.ts†L1-L200】

### Storage and configuration services

- A pooled Postgres connector lazily initializes from environment variables, supports runtime reconfiguration, and exposes query helpers for feature modules.【F:remoteiq-minimal-e2e/backend/src/storage/pg-pool.service.ts†L1-L106】

## Dashboard capabilities

### Technology stack

The dashboard targets Next.js 15 with React 19 RC, Radix UI, Tailwind CSS, Recharts, TanStack utilities, drag-and-drop libraries, multi-database client SDKs, and lint/typecheck tooling for a rich operator experience.【F:remoteiq-frontend/package.json†L1-L71】

### Dashboards and analytics

The primary dashboard route renders KPI cards, donut charts, heatmaps, and stacked client/site visualizations using react-grid-layout for drag-and-drop rearrangement and persisted layouts for operators.【F:remoteiq-frontend/app/(dashboard)/page.tsx†L1-L200】

### Saved views, filters, and hierarchy

Dashboard context providers normalize device status, manage saved views in local storage, encode/decode layouts into URL payloads, and coordinate device filters, column state, and sidebar expansions for customer/site hierarchies.【F:remoteiq-frontend/app/(dashboard)/dashboard-context.tsx†L1-L200】

The customers page bridges the saved-view system with organization/site expanders, matching devices against hierarchical filters and global status/OS selections before rendering data tables.【F:remoteiq-frontend/app/customers/page.tsx†L1-L160】

### Device workspace

Device detail pages merge local dashboard state with authoritative API data, expose breadcrumb navigation, render tabbed insights (software inventory, checks/alerts, patching, remote), and provide contextual actions for reboot, patch, and scripted remediation workflows.【F:remoteiq-frontend/app/(dashboard)/devices/[deviceId]/page.tsx†L1-L200】

### Branding-aware login experience

The login flow respects tenant branding assets, enforces safe redirect targets, manages remembered email addresses, supports two-factor authentication challenges with recovery codes, and persists trusted-device choices when verifying OTPs.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L1-L200】

Branding providers fetch theming from the backend, set CSS variables, swap favicons, and expose preview/clear APIs so administrators can stage visual changes before saving them server-side.【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L1-L200】

### Typed API client and automation hooks

A centralized API utility wraps authenticated fetch calls, defines typed payloads for devices, checks, software, device actions, automation runs, and administrative database configuration, and exposes helper functions that the dashboard and automation panels consume.【F:remoteiq-frontend/lib/api.ts†L1-L240】

Client hooks handle pagination, debounced searching, OS/status filters, cursor-based loading, and cancellation of in-flight requests to keep device tables responsive under large datasets.【F:remoteiq-frontend/lib/use-devices.ts†L1-L168】

## Windows agent capabilities

The RemoteIQ Windows agent is a .NET 8 service installed under the LocalService account, performing secure enrollment, RSA-PSS-validated job execution, DPAPI-protected secret storage, optional TLS pinning, log emission to `%ProgramData%/RemoteIQ/Logs`, and staged self-updates through packaged scripts.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L51】

## Operational workflows

### Provisioning and authentication

Operators authenticate via the `/api/auth/login` endpoint, receive JWT cookies, and—when two-factor is enabled—complete OTP or recovery code verification before trusted-device tokens are recorded for future logins.【F:remoteiq-minimal-e2e/backend/src/auth/auth.controller.ts†L15-L106】

### Agent enrollment and job lifecycle

Agents connect over `/ws`, send hello frames with identifiers, and immediately receive queued jobs; execution results flow back to the jobs service, which finalizes status and stores stdout/stderr for dashboard retrieval.【F:remoteiq-minimal-e2e/backend/src/ws/agent.gateway.ts†L67-L190】

### Run-script automation

Automation requests queue device-targeted scripts that the dispatcher delivers via WebSocket, ensuring payload validation and failure handling while the API surfaces job status and log retrieval endpoints for operators.【F:remoteiq-minimal-e2e/backend/src/automation/automation.service.ts†L1-L50】【F:remoteiq-minimal-e2e/backend/src/jobs/dispatcher.service.ts†L39-L111】【F:remoteiq-frontend/lib/api.ts†L170-L199】

### Branding and support setup

Administrative tools can apply tenant branding (logos, CSS, email chrome) and update support/legal contact surfaces through dedicated services, enabling per-tenant customization of the dashboard and outbound communications.【F:remoteiq-minimal-e2e/backend/src/branding/branding.service.ts†L67-L138】【F:remoteiq-minimal-e2e/backend/src/support/support.service.ts†L10-L56】

## Getting started

### Backend API (NestJS)

1. Install dependencies with your preferred Node.js package manager (the project includes PNPM metadata).【F:remoteiq-minimal-e2e/backend/package.json†L1-L68】
2. Copy `.env.example` to `.env`, populate JWT secrets, enrollment keys, admin API keys, and email credentials as needed.【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】
3. Select a database:
   - For local prototyping, keep the default SQLite Prisma datasource (`DATABASE_URL="file:./dev.db"`).【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L53】
   - For PostgreSQL, start `docker-compose.db.yml` (Postgres + pgAdmin) and point `DATABASE_URL` to the containerized instance described in `config/database.json`.【F:remoteiq-minimal-e2e/backend/docker-compose.db.yml†L1-L51】【F:remoteiq-minimal-e2e/backend/config/database.json†L1-L23】
4. Generate Prisma artifacts and run migrations: `pnpm prisma:generate && pnpm prisma:migrate:dev`.【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】
5. Launch the API with `pnpm dev`; Swagger docs (`/docs`), health probes (`/healthz`), static assets (`/static/*`), and WebSocket endpoints mount automatically during bootstrap.【F:remoteiq-minimal-e2e/backend/src/main.ts†L88-L136】

### Web dashboard (Next.js)

1. Install dependencies in `remoteiq-frontend/` using PNPM, npm, or yarn.【F:remoteiq-frontend/package.json†L1-L11】
2. Configure `.env.local` (or hosting secrets) with `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_WS_BASE` to target your backend REST and WebSocket origins.【F:remoteiq-frontend/lib/api.ts†L1-L57】【F:remoteiq-frontend/lib/ws.ts†L1-L27】
3. Run `pnpm dev` (or `npm run dev`) to start the Next.js app router with middleware, Tailwind, and component hot reloading.【F:remoteiq-frontend/package.json†L5-L11】
4. Navigate to `http://localhost:3000` to access the branding-aware login flow with built-in two-factor handling.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L1-L200】

### Windows service agent

1. Install the .NET 8 SDK pinned by `global.json` (`8.0.415`).【F:global.json†L1-L5】
2. From `remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/`, run `dotnet publish -c Release -r win-x64` to produce self-contained binaries.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L5-L12】
3. Deploy with `scripts/install-agent.ps1`, specifying your API base URL and agent group; the service runs under `LocalService` and stores DPAPI-protected configuration in `%ProgramData%/RemoteIQ`.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L14-L33】
4. Validate the documented REST endpoints to ensure enroll, heartbeat, inventory, job dispatch, completion, and update flows are wired before production rollout.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L35-L44】

## Configuration reference

- Backend environment variables include service ports, JWT secrets, database URLs, SMTP timeouts, TLS policies, DKIM overrides, and WebSocket cookie names; adjust per deployment by editing `.env` and service-specific env vars (e.g., `SMTP_*`, `PG*`, `AUTH_COOKIE_*`).【F:remoteiq-minimal-e2e/backend/src/main.ts†L46-L135】【F:remoteiq-minimal-e2e/backend/src/smtp/smtp.service.ts†L48-L200】
- Frontend configuration relies on `NEXT_PUBLIC_API_BASE` for REST, `NEXT_PUBLIC_WS_BASE` for socket adapters, and reads tenant branding via `/api/branding`. Update these when deploying behind proxies or custom domains.【F:remoteiq-frontend/lib/api.ts†L1-L57】【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L105-L198】
- Outbound email and inbound intake modules expect SMTP/IMAP credentials stored in the database; administrative screens can call the SMTP service to persist encrypted secrets and DKIM keys.【F:remoteiq-minimal-e2e/backend/src/smtp/smtp.service.ts†L70-L200】
- Support/legal contact information lives in the `support_legal_settings` table managed by the support service, ensuring a single authoritative source for portal links and compliance content.【F:remoteiq-minimal-e2e/backend/src/support/support.service.ts†L10-L56】

## Development and testing

- Backend scripts: `pnpm dev` (watch mode), `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm health` (service check).【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】
- Frontend scripts: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`.【F:remoteiq-frontend/package.json†L5-L11】
- Agent build: `dotnet publish -c Release -r win-x64` (self-contained).【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L5-L12】

## Resources

- `remoteiq_export.txt` – example data export for populating dashboards in demo environments.
- `riq-support.txt` – summary of support/legal requirements to mirror in your tenant configuration.
