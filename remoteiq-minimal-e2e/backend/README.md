# RemoteIQ Backend Link‑Up Pack

This pack contains drop‑in files to wire your existing NestJS + Prisma backend to the front end expectations described in your specs.

## What’s included
- `/src/health/health.controller.ts` → `GET /healthz`
- `/src/devices/*` → `GET /api/devices` with cursor pagination and filters (`status`, `os`, `q`)
- `/src/common/pagination.ts` → tiny helper for cursor encoding/decoding
- `main.swagger.example.ts` → Swagger bootstrapping you can merge into `src/main.ts`
- `app.module.patch.txt` → minimal import snippet to register the new modules
- `ws.gateway.patch.txt` → optional change to align WebSocket path to `/ws` (spec)
- `postman_collection.json` → quick requests for health and devices
- `HOWTO.md` → step‑by‑step instructions

## Quick install
1. Copy the `src` folder into your backend repo (safe to merge; only adds files).
2. Open `src/app.module.ts` and add:
   ```ts
   import { DevicesModule } from "./devices/devices.module";
   import { HealthModule } from "./health/health.module";
   @Module({ imports: [ /* existing */ , DevicesModule, HealthModule ] })
   ```
3. (Optional) In `src/main.ts`, enable Swagger like `main.swagger.example.ts` shows.
4. `pnpm i && pnpm prisma:migrate:dev && pnpm dev`
5. Test: `GET http://localhost:3001/healthz` and `GET http://localhost:3001/api/devices`

