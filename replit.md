# Dolibarr EDU

Plataforma de gestión para centros de FP de Administración de Empresas. Permite que cada alumno tenga su propia empresa simulada en Dolibarr ERP, con profesores gestionando sus grupos de manera independiente.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path /api)
- `pnpm --filter @workspace/panel run dev` — run the frontend panel (port 19076, path /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + TanStack Query
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM table definitions (teachers, groups, students)
- `artifacts/api-server/src/routes/` — Express route handlers (teachers, groups, students, stats)
- `artifacts/panel/src/` — React frontend (landing page + admin panel)
- `dolibarr-edu/` — Docker deployment package for school servers
  - `install.sh` — One-line installer from GitHub
  - `update.sh` — Update script from GitHub
  - `docker-compose.yml` — Dolibarr + MariaDB + Cloudflare tunnel
  - `scripts/` — CLI tools for managing teachers/groups/students

## Architecture decisions

- Multi-company Dolibarr via the native `modMultiCompany` module — each student gets an independent entity
- Password hashing with SHA-256 (suitable for ERP sync passwords, not user auth)
- The panel API uses PostgreSQL as its own source of truth and syncs to Dolibarr via its REST API
- Cloudflare Tunnel for HTTPS without opening ports on the school firewall
- Install/update scripts pull from https://github.com/innovafpiesmmg/Dolibarr-Edu

## Product

- **Landing page** (`/`) — public marketing page explaining Dolibarr EDU
- **Dashboard** (`/dashboard`) — overview stats: teachers, groups, students per group
- **Profesores** (`/profesores`, `/profesores/:id`) — full CRUD with group/student counts
- **Grupos** (`/grupos`, `/grupos/:id`) — full CRUD with student roster
- **Alumnos** (`/alumnos`, `/alumnos/:id`) — full CRUD with company/Dolibarr entity info
- **Importar** (`/importar`) — bulk student import from CSV

## User preferences

- Application is in Spanish throughout
- Target deployment: local school server + Cloudflare tunnel for external access
- GitHub repo: https://github.com/innovafpiesmmg/Dolibarr-Edu

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change
- Run `pnpm --filter @workspace/db run push` after any schema change
- The `dolibarr-edu/` folder is a standalone deployment package — it is NOT the Node.js app
- Students route registers `/students/bulk` BEFORE `/students/:id` to avoid route conflicts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
