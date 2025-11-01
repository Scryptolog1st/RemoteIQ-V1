# RemoteIQ V1

RemoteIQ is an end-to-end remote monitoring and management (RMM) platform that combines a modern Next.js dashboard, a NestJS API, and production-ready Windows agents to monitor endpoints, dispatch jobs, and deliver realtime insights. The repository contains everything needed to run the control plane, brand the tenant experience, and build or package field agents.

## Table of contents

- [Architecture overview](#architecture-overview)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
  - [Backend API (NestJS)](#backend-api-nestjs)
  - [Web dashboard (Next.js)](#web-dashboard-nextjs)
  - [Windows service agent](#windows-service-agent)
- [Key features](#key-features)
  - [Backend platform](#backend-platform)
  - [Dashboard experience](#dashboard-experience)
  - [Endpoint agents](#endpoint-agents)
- [Configuration and environment](#configuration-and-environment)
- [Development tips](#development-tips)

## Architecture overview

The control plane is implemented in NestJS with discrete modules for authentication, agent orchestration, job dispatch, realtime WebSocket gateways, SMTP/IMAP integrations, and administrative tooling. Static assets are served directly from the API service, and the module graph is wired in `AppModule` with cookie-aware middleware and scheduled maintenance jobs.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L3-L95】

The web dashboard is a Next.js 15 application that ships with opinionated UI primitives, data visualization components, and grid-based layouts for customizable RMM views. It depends on React 19 release candidates, Radix UI, TanStack utilities, Tailwind CSS, and charting libraries to build rich operator workflows.【F:remoteiq-frontend/package.json†L1-L71】

Endpoint visibility is provided by a hardened .NET 8 Windows service agent that authenticates with the RemoteIQ backend, emits heartbeats and inventory snapshots, executes signed jobs, and can self-update in stages for safe rollouts.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L51】【F:global.json†L1-L5】

## Repository layout

| Path | Description |
| ---- | ----------- |
| `remoteiq-frontend/` | Next.js dashboard including the app router, UI components, Tailwind configuration, and middleware for cookie-protected routes.【F:remoteiq-frontend/package.json†L1-L71】【F:remoteiq-frontend/middleware.ts†L1-L60】 |
| `remoteiq-minimal-e2e/backend/` | NestJS API with Prisma models, REST and WebSocket endpoints, SMTP/IMAP tooling, and Docker assets for the control-plane backend.【F:remoteiq-minimal-e2e/backend/package.json†L1-L68】【F:remoteiq-minimal-e2e/backend/docker-compose.db.yml†L1-L51】 |
| `remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/` | Windows service agent source, packaging scripts, and security guidance for deploying managed endpoints.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L1-L51】 |
| `Directory.Packages.props` | Centralized NuGet package version management for all .NET projects in the solution.【F:Directory.Packages.props†L1-L14】 |
| `package.json` | Shared Node dependencies (JWT, cookie parsing, WebSocket support) used across tools and services at the monorepo root.【F:package.json†L1-L11】 |

## Getting started

### Backend API (NestJS)

1. Install dependencies with your preferred Node.js package manager (the project ships with `pnpm` workspace metadata).【F:remoteiq-minimal-e2e/backend/package.json†L1-L68】【F:remoteiq-minimal-e2e/backend/pnpm-workspace.yaml†L1-L8】
2. Copy `.env.example` to `.env` and populate secrets for JWT signing, agent enrollment, and the optional admin API key.【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】
3. Choose your database:
   - For local development, the default Prisma datasource uses SQLite (`DATABASE_URL="file:./dev.db"`).【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L53】
   - For Postgres, start the bundled `docker-compose.db.yml` stack (PostgreSQL + pgAdmin) and point `DATABASE_URL` to the containerized instance described in `config/database.json`.【F:remoteiq-minimal-e2e/backend/docker-compose.db.yml†L1-L51】【F:remoteiq-minimal-e2e/backend/config/database.json†L1-L23】
4. Generate the Prisma client and apply migrations: `pnpm prisma:generate && pnpm prisma:migrate:dev`.【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】
5. Launch the API in watch mode: `pnpm dev`. The server exposes REST, WebSocket, Swagger (when enabled), health probes, and static asset hosting from `/public` as configured in `main.ts`.【F:remoteiq-minimal-e2e/backend/src/main.ts†L1-L136】

### Web dashboard (Next.js)

1. Install dependencies in `remoteiq-frontend/`.
2. Configure the dashboard to point at your backend by setting `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_WS_BASE` (via `.env.local` or your hosting provider). These values drive REST calls and WebSocket connections throughout the app.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L34-L175】【F:remoteiq-frontend/lib/ws.ts†L1-L27】
3. Start the development server with `pnpm dev` (or `npm run dev`). Next.js will serve the app router, proxy middleware, and Tailwind styles in watch mode.【F:remoteiq-frontend/package.json†L5-L11】
4. Visit `http://localhost:3000` to access the login experience, which supports 2FA verification and branding-aware theming out of the box.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L45-L200】

### Windows service agent

1. Install the .NET 8 SDK (the repository pins version `8.0.415`).【F:global.json†L1-L5】
2. Build the agent from `remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/` using `dotnet publish -c Release -r win-x64` to produce the self-contained service binaries.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L5-L12】
3. Deploy the service with the provided PowerShell scripts, pointing it at your API base URL and desired agent group. Installation runs under the least-privileged `LocalService` account and persists secure configuration with DPAPI.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L14-L33】
4. Review the expected backend endpoints in the README to confirm enrollment, heartbeat, job execution, and update flows before rolling out to production sites.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L35-L44】

## Key features

### Backend platform

- Modular NestJS architecture covering common RMM domains such as agent enrollment, job orchestration, device inventory, SMTP notifications, IMAP intake, and administrative tooling, all wired through `AppModule` for easy customization.【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L7-L74】
- Express-based bootstrap that exposes Swagger (optional), CORS controls, static assets, cookie parsing, WebSocket adapters, validation pipes, health checks, and session heartbeat tracking for active users.【F:remoteiq-minimal-e2e/backend/src/main.ts†L19-L136】
- Prisma data model for agents, jobs, and job results, enabling rapid prototyping with SQLite or production deployment with Postgres via environment configuration.【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L1-L53】【F:remoteiq-minimal-e2e/backend/config/database.json†L1-L23】

### Dashboard experience

- Drag-and-drop dashboard composed with `react-grid-layout`, rich KPI cards, heatmaps, and donut charts powered by Recharts to visualize device status, OS mix, and client/site distributions.【F:remoteiq-frontend/app/(dashboard)/page.tsx†L20-L200】
- Authentication middleware that normalizes legacy routes, protects application paths with cookie-based sessions, and gracefully redirects unauthenticated users to the login page.【F:remoteiq-frontend/middleware.ts†L1-L60】
- Login flow with built-in two-factor challenge handling, remember-device support, and tenant branding hooks (logos, backgrounds, favicon) managed through the `BrandingProvider` and persisted in local storage for user convenience.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L21-L200】【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L5-L198】
- Lightweight WebSocket client utilities that stream realtime events from the backend using `NEXT_PUBLIC_WS_BASE`, keeping dashboards responsive without manual polling.【F:remoteiq-frontend/lib/ws.ts†L1-L27】

### Endpoint agents

- Production-focused Windows service implementation featuring signed task enforcement, DPAPI-protected secrets, optional TLS pinning, and LocalService execution by default.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L3-L33】
- Scripted installation and removal workflows plus documented REST contracts to ensure parity between agent expectations and backend controller implementations.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L14-L51】
- Central NuGet package management keeps agent dependencies consistent across solutions and simplifies servicing updates.【F:Directory.Packages.props†L1-L14】

## Configuration and environment

- Backend environment variables cover runtime basics (`NODE_ENV`, `PORT`), database connectivity, enrollment secrets, admin API keys, and JWT signing. Copy `.env.example` to bootstrap local development.【F:remoteiq-minimal-e2e/backend/.env.example†L1-L6】
- Frontend configuration relies on `NEXT_PUBLIC_API_BASE` for REST calls and `NEXT_PUBLIC_WS_BASE` for realtime channels; update these when deploying behind proxies or custom domains.【F:remoteiq-frontend/app/(auth)/login/page.tsx†L34-L135】【F:remoteiq-frontend/lib/ws.ts†L7-L22】
- Outbound email and inbound intake can be enabled by configuring the SMTP and IMAP modules in the backend (`SmtpModule`, `ImapModule`).【F:remoteiq-minimal-e2e/backend/src/app.module.ts†L21-L73】
- Database connection templates for Postgres live in `config/database.json`, while the default Prisma datasource targets SQLite for ease of development.【F:remoteiq-minimal-e2e/backend/config/database.json†L1-L23】【F:remoteiq-minimal-e2e/backend/prisma/schema.prisma†L5-L53】

## Development tips

- Use the `health` npm script in the backend to quickly check service availability once the API is running.【F:remoteiq-minimal-e2e/backend/package.json†L5-L15】
- When extending the dashboard, prefer the shared UI primitives under `remoteiq-frontend/components` and update the `BrandingProvider` if additional theming tokens are introduced.【F:remoteiq-frontend/package.json†L1-L71】【F:remoteiq-frontend/app/providers/BrandingProvider.tsx†L5-L198】
- Keep agents aligned with backend expectations by regenerating and distributing new public keys whenever signing policies change; the agent README lists the required endpoints and payloads.【F:remoteiq-minimal-e2e/agents/windows/RemoteIQ.Agent/README.md†L3-L44】

