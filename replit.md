# ERP EDU

Plataforma de gestión para centros de FP de Administración de Empresas. **Cada alumno tiene su propio contenedor Dolibarr ERP aislado** (con base de datos independiente), orquestado desde el panel. Los profesores gestionan sus grupos y empresas simuladas de manera independiente.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — arranca el servidor API (puerto 8080, path /api)
- `pnpm --filter @workspace/panel run dev` — arranca el panel frontend (puerto 19076, path /)
- `pnpm run typecheck` — typecheck completo de todos los paquetes
- `pnpm run build` — typecheck + build de todos los paquetes
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks y schemas Zod desde el spec OpenAPI (también reescribe el barrel api-zod/src/index.ts para evitar colisiones de nombres)
- `pnpm --filter @workspace/db run push` — aplica cambios de schema a la BD (solo dev)
- Env requerido: `DATABASE_URL` — cadena de conexión Postgres

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- BD: PostgreSQL + Drizzle ORM
- Validación: Zod (`zod/v4`), `drizzle-zod`
- Codegen API: Orval (desde spec OpenAPI)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + TanStack Query
- Build: esbuild (bundle CJS)

## Where things live

- `lib/api-spec/openapi.yaml` — fuente de verdad para todos los contratos API
- `lib/db/src/schema/` — definiciones de tablas Drizzle ORM
  - `teachers.ts`, `groups.ts`, `students.ts`
  - `employees.ts` — empleados para nóminas
  - `payrolls.ts` — nóminas mensuales
  - `ss-payments.ts` — estado de liquidaciones SS/IRPF por período
  - `settings.ts` — configuración del panel (clave/valor)
- `artifacts/api-server/src/routes/` — handlers Express
  - `teachers.ts`, `groups.ts`, `students.ts`, `stats.ts`
  - `deploy.ts` — despliegue + ciclo de vida del contenedor Dolibarr de cada alumno (deploy, start, stop, restart, destroy, state)
  - `employees.ts`, `payrolls.ts`, `ss.ts` — módulo de nóminas y Seguridad Social
  - `settings.ts` — configuración del panel (taxSystem, baseDomain, currency, language)
  - `auth.ts` — autenticación del panel y sesión de alumno (redirige a `https://{user}.{baseDomain}/`)
- `artifacts/api-server/src/lib/docker.ts` — wrapper de `dockerode` sobre el socket UNIX
  - `isDockerAvailable`, `ensureStudentContainer`, `start/stop/restart/remove`, `getContainerState`
- `artifacts/api-server/src/lib/mariadb.ts` — wrapper de `mysql2/promise` sobre la MariaDB compartida
  - `isMariaDbAvailable`, `createStudentDatabase`, `dropStudentDatabase`
- `artifacts/api-server/src/lib/student-dolibarr.ts` — utilidades por-alumno
  - `studentContainerName`, `studentDbName`, `studentDbUser`, `studentSubdomain`, `studentPublicUrl`
  - `studentDolibarrConfig(student, settings)` — construye `DolibarrConfig` apuntando al contenedor del alumno
- `artifacts/api-server/src/lib/dolibarr.ts` — integración Dolibarr REST API (todas las funciones reciben `DolibarrConfig` explícito)
  - `createDolibarrUser`, `createDolibarrEmployee`, `createDolibarrSalary`
  - `createPayrollAccountingEntry` — asiento contable 640/642/465/476/4751
  - `paySSToBank` — asiento 476→572 (SS Tesorería)
  - `payIRPFToBank` — asiento 4751→572 (Hacienda, Modelo 111)
- `artifacts/panel/src/` — frontend React
  - `pages/landing.tsx` — página pública de presentación
  - `pages/dashboard/` — estadísticas generales
  - `pages/profesores/` — CRUD profesores
  - `pages/grupos/` — CRUD grupos
  - `pages/alumnos/` — CRUD alumnos
  - `pages/importar/` — importación masiva CSV
  - `pages/nominas/` — módulo nóminas: index, empleados, nueva, detalle, ss
  - `pages/configuracion/` — configuración fiscal y dominio base del panel
- `dolibarr-edu/` — paquete Docker para servidores del centro (standalone, no es la app Node)
  - `install.sh` — instalador con una línea desde GitHub
  - `update.sh` — actualización desde GitHub
  - `docker-compose.yml` — Dolibarr + MariaDB + túnel Cloudflare
  - `scripts/` — herramientas CLI para gestionar profesores/grupos/alumnos

## Architecture decisions

- **Un contenedor Dolibarr por alumno** orquestado desde el panel a través del socket Docker (`/var/run/docker.sock`). Sustituye el enfoque anterior de "single-entity + tercero por alumno" — MultiCompany fue descontinuado por su autor en Dolistore y no hay alternativas viables.
- **MariaDB compartida** (un solo servicio) con una base de datos por alumno (`dolibarr_alu_<username>`) y un usuario por alumno con privilegios sólo sobre su BD. Reduce uso de RAM frente a una MariaDB por contenedor — viable para <30 alumnos en un servidor de 16 GB.
- **Traefik** como reverse proxy escuchando en `TRAEFIK_PORT` (por defecto 8090). Usa **file provider** (no docker provider): el panel escribe `student-<user>.yaml` en un volumen compartido `traefik_dynamic` con la regla `Host(<usuario>.<BASE_DOMAIN>)` apuntando a `http://dolibarr_alu_<user>:80`. Traefik vigila el directorio y recarga en caliente. El túnel Cloudflare apunta un comodín `*.<BASE_DOMAIN>` a Traefik.
- **Nombres deterministas**: `dolibarr_alu_<username>` (contenedor + BD + usuario MariaDB). El subdominio es el `username` saneado.
- **Contraseñas deterministas**: Dolibarr/MariaDB de cada alumno se derivan de `SHA-256(<role>:<username> + SESSION_SECRET)`, por lo que no se almacenan en BD (sólo se muestran en el panel cuando se necesitan).
- **Lifecycle endpoints**: `POST /students/:id/deploy|container/start|stop|restart` + `DELETE /students/:id/container` (destruye contenedor + BD).
- Hash de contraseñas con SHA-256 (adecuado para sincronización con ERP, no para auth humana).
- El API del panel usa PostgreSQL como fuente de verdad; sincroniza con el Dolibarr de cada alumno vía su API REST.
- Cloudflare Tunnel para HTTPS sin abrir puertos en el cortafuegos del centro.
- Scripts de instalación/actualización extraídos desde https://github.com/innovafpiesmmg/Dolibarr-Edu
- Régimen fiscal configurable (IGIC por defecto para Canarias / IVA para Península), moneda EUR e idioma es_ES — se aplican al provisionar cada Dolibarr de alumno.

## Product

- **Landing page** (`/`) — página pública con portal de acceso para alumnos
- **Dashboard** (`/dashboard`) — estadísticas: profesores, grupos, alumnos por grupo
- **Profesores** (`/profesores`, `/profesores/:id`) — CRUD completo con conteo de grupos/alumnos
- **Grupos** (`/grupos`, `/grupos/:id`) — CRUD completo con listado de alumnos
- **Alumnos** (`/alumnos`, `/alumnos/:id`) — CRUD completo con estado del contenedor Docker (running/exited/absent), botones de iniciar/detener/eliminar, URL pública (`https://<usuario>.<baseDomain>/`)
- **Importar** (`/importar`) — importación masiva de alumnos desde CSV
- **Nóminas** (`/nominas`) — listado de nóminas con filtros
- **Empleados** (`/nominas/empleados`) — CRUD de empleados vinculados a alumnos
- **Nueva nómina** (`/nominas/nueva`) — cálculo y registro de nómina mensual
- **Detalle nómina** (`/nominas/:id`) — consulta y sincronización con Dolibarr HRM
- **Liquidaciones SS** (`/nominas/ss`) — RNT, RLC, asientos SS e IRPF (Modelo 111) en Dolibarr
- **Configuración** (`/configuracion`) — régimen fiscal (IGIC/IVA), **dominio base** para subdominios de Dolibarr, idioma y moneda del ERP

## User preferences

- Aplicación en español en todo momento
- Despliegue destino: servidor local del centro + túnel Cloudflare para acceso externo
- Repo GitHub: https://github.com/innovafpiesmmg/Dolibarr-Edu

## Cloudflare Tunnel — Public Hostnames

Solo dos conectores a configurar en el túnel Cloudflare del centro (ambos obligatorios para acceso público).

| Subdominio | Servicio Docker | Descripción |
|---|---|---|
| `panel.iesmmg.es` | `http://panel_web:80` | Panel de gestión + landing page (mismo container) |
| `*.erp.iesmmg.es` (comodín) | `http://traefik:80` | Un subdominio por alumno (`<usuario>.erp.iesmmg.es`) → su contenedor Dolibarr vía Traefik |

> Puerto interno de Traefik = `80` (el `TRAEFIK_PORT` del `.env` es solo el mapeo al host para `curl localhost`).

## Gotchas

- Ejecutar `pnpm --filter @workspace/api-spec run codegen` después de cualquier cambio en el spec OpenAPI
  - El script también reescribe `lib/api-zod/src/index.ts` para evitar colisiones de nombres entre schemas Zod y tipos TypeScript
- Ejecutar `pnpm --filter @workspace/db run push` después de cualquier cambio de schema
- La carpeta `dolibarr-edu/` es un paquete de despliegue standalone — NO es la app Node.js
- La ruta de alumnos registra `/students/bulk` ANTES de `/students/:id` para evitar conflictos de ruta
- En `App.tsx`, rutas estáticas (`/nominas/ss`, `/nominas/nueva`) deben declararse ANTES de `/nominas/:id`
- **dockerode / docker-modem** requieren `ssh2`, `@grpc/grpc-js`, `@grpc/proto-loader` y `protobufjs` de forma eager aunque sólo usemos el socket UNIX. `artifacts/api-server/build.mjs` los stubea vía un plugin de esbuild — si actualizas dockerode revisa que el conjunto siga cubriendo todos los `require` top-level de `dockerode/lib/session.js` y `docker-modem/lib/*.js`.
- **Traefik file provider en modo `directory` solo procesa `.toml`/`.yml`/`.yaml`** — ignora `.json` silenciosamente (lee el fichero pero descarta su contenido sin error). Los ficheros dinámicos se escriben con extensión `.yaml` (JSON es YAML válido, así que el contenido sigue siendo `JSON.stringify`).
- **No usar el docker provider de Traefik** contra Docker Engine 25+ (MinAPIVersion 1.44): el cliente Go embebido negocia API 1.24 y falla. Por eso el ruteo va vía file provider; los labels `traefik.*` que `docker.ts` añade a los contenedores de alumno son inocuos pero ya no se usan.
- El campo histórico `dolibarrEntityId` ya **NO existe** en BD/API/UI tras el pivot a contenedor-por-alumno. El identificador ahora es `containerName` + `publicUrl`, expuestos por `GET /students/:id/container`.

## Pointers

- Ver el skill `pnpm-workspace` para estructura del workspace, configuración TypeScript y detalles de paquetes
