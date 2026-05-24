# Dolibarr EDU

Plataforma de gestión educativa para centros de **Formación Profesional de Administración de Empresas**. Permite que cada alumno tenga su propia empresa simulada en Dolibarr ERP, gestionada por sus profesores de forma centralizada.

Desarrollado por **Atreyu Servicios Digitales (ASD)**.

---

## Capturas de pantalla

### Página de inicio — acceso del alumno a su empresa
![Landing page](screenshots/landing.jpg)

### Panel de gestión — acceso del profesorado
![Panel de gestión](screenshots/login.jpg)

---

## Índice

1. [Descripción general](#descripción-general)
2. [Características](#características)
3. [Arquitectura](#arquitectura)
4. [Instalación en servidor del centro](#instalación-en-servidor-del-centro)
5. [Actualización](#actualización)
6. [Configuración](#configuración)
7. [Panel de gestión — guía de uso](#panel-de-gestión--guía-de-uso)
8. [Portal del alumno](#portal-del-alumno)
9. [Desarrollo local](#desarrollo-local)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [API](#api)
12. [Seguridad](#seguridad)
13. [Tecnologías](#tecnologías)

---

## Descripción general

Dolibarr EDU resuelve el principal reto de la FP de Administración: proporcionar a cada alumno un entorno ERP real e independiente sin necesidad de licencias comerciales ni infraestructura compleja.

Cada alumno recibe:
- Su propio usuario y contraseña
- Una empresa aislada en Dolibarr (entidad multi-empresa)
- Acceso directo desde la landing page del centro

El profesorado gestiona grupos, alumnos, accesos y nóminas desde un panel web centralizado protegido con contraseña.

---

## Características

### Panel de gestión
- **Dashboard** con estadísticas en tiempo real: total de profesores, grupos, alumnos y distribución por grupo
- **Gestión de profesores** — alta, edición y baja con conteo de grupos y alumnos asignados
- **Gestión de grupos** — CRUD completo con asignación de profesor responsable
- **Gestión de alumnos** — búsqueda, filtrado por grupo, alta, edición y baja
- **Exportar CSV** — descarga el listado completo de alumnos (con estado de sincronización) en formato Excel-compatible
- **Importación masiva** — carga de alumnos por CSV con resumen de errores
- **Restablecer contraseña** — genera una nueva contraseña para cualquier alumno y la sincroniza con Dolibarr
- **Acceso protegido** — contraseña configurada en la instalación, sesión persistente en navegador

### Módulo de nóminas
- **Empleados** — vincula empleados del centro a alumnos para las prácticas de nóminas
- **Nueva nómina** — cálculo completo de nómina mensual (salario bruto, IRPF, cuotas SS obrero/empresa)
- **Detalle de nómina** — consulta y sincronización del asiento contable 640/642/465/476/4751 con Dolibarr HRM
- **Liquidaciones SS** — generación de RNT y RLC, asientos de pago a Tesorería (476→572) y a Hacienda — Modelo 111 (4751→572)

### Sincronización con Dolibarr
- **Estado de sincronización** (`/estado`) — vista global del despliegue de alumnos con filtros por estado (desplegado / error / pendiente), botón de reintento por alumno e indicador de errores activos
- **Despliegue automático** — crea entidad empresa, usuario ERP y configura régimen fiscal (IGIC por defecto para Canarias, IVA para Península)

### Administración
- **Historial de actividad** (`/actividad`) — registro cronológico de todas las acciones del panel: altas, bajas, despliegues, cambios de contraseña, etc., con filtros por tipo de entidad
- **Configuración fiscal** (`/configuracion`) — régimen fiscal (IGIC/IVA), moneda y idioma aplicados al crear entidades en Dolibarr

### Portal del alumno (landing page)
- Formulario de acceso con usuario y contraseña en la página pública
- Muestra el nombre del alumno y su empresa al autenticarse
- Botón directo a la empresa en Dolibarr (entidad asignada)

### Despliegue en servidor escolar
- Instalación con un único comando `curl`
- Docker Compose con Dolibarr + MariaDB + Cloudflare Tunnel
- Scripts CLI para gestión avanzada desde terminal
- Script de actualización con backup automático

---

## Arquitectura

```
Internet
   │
   ▼
Cloudflare Tunnel (HTTPS sin abrir puertos)
   │
   ▼
Servidor del centro (Ubuntu/Debian)
   ├── Dolibarr ERP (Docker)        ← una entidad por alumno
   ├── MariaDB (Docker)             ← base de datos de Dolibarr
   └── Panel EDU (Node.js + PostgreSQL)
          ├── API REST (/api)       ← Express + Drizzle ORM
          └── Frontend (/)          ← React + Vite
```

**Modelo multi-empresa:** Se utiliza el módulo nativo `modMultiCompany` de Dolibarr. Cada alumno es una entidad independiente, completamente aislada del resto.

---

## Instalación en servidor del centro

### Requisitos previos
- Ubuntu 22.04 / Debian 12 (o compatible)
- Usuario con `sudo` (no ejecutar como root)
- Conexión a internet

### Instalación con un comando

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/install.sh | bash
```

El script realiza automáticamente:
1. Instala Docker si no está presente
2. Clona el repositorio en `/opt/dolibarr-edu`
3. Genera contraseñas aleatorias para la base de datos
4. **Solicita la contraseña del panel** (dos veces para confirmar)
5. **Solicita la URL pública de Dolibarr** (ej: `https://erp.micentro.es`)
6. Muestra las credenciales de administrador de Dolibarr

### Pasos post-instalación

```bash
# 1. Revisa la configuración (si necesitas ajustar algo)
nano /opt/dolibarr-edu/.env

# 2. Arranca los servicios
cd /opt/dolibarr-edu && docker compose up -d

# 3. Configura el túnel Cloudflare
#    Edita cloudflare/config.yml con tu token de túnel

# 4. Configura el entorno educativo (crear primer grupo, etc.)
cd /opt/dolibarr-edu && ./scripts/setup-inicial.sh
```

### Scripts CLI disponibles

| Script | Descripción |
|--------|-------------|
| `./scripts/setup-inicial.sh` | Configuración inicial del entorno |
| `./scripts/crear-grupo.sh` | Crear un grupo de clase en Dolibarr |
| `./scripts/crear-alumnos.sh` | Crear alumnos individualmente |
| `./scripts/listar-grupos.sh` | Listar grupos y alumnos desde terminal |

---

## Actualización

```bash
cd /opt/dolibarr-edu && ./update.sh
```

El script de actualización:
1. Crea un backup automático de `.env` y los datos
2. Descarga la última versión desde GitHub
3. Restaura la configuración del centro
4. Reinicia los contenedores Docker

---

## Configuración

El archivo `.env` (en `/opt/dolibarr-edu/.env` en producción) contiene todas las variables de configuración:

| Variable | Descripción |
|----------|-------------|
| `ADMIN_PASSWORD_HASH` | Hash SHA-256 de la contraseña del panel |
| `SESSION_SECRET` | Clave secreta para firmar tokens de sesión |
| `DOLIBARR_BASE_URL` | URL pública de Dolibarr (ej: `https://erp.micentro.es`) |
| `DOLIBARR_API_KEY` | Clave API del administrador de Dolibarr |
| `DATABASE_URL` | Cadena de conexión PostgreSQL del panel EDU |
| `DOLI_DB_PASSWORD` | Contraseña de la base de datos de Dolibarr |
| `DOLI_ADMIN_PASSWORD` | Contraseña del administrador de Dolibarr |

### Cambiar la contraseña del panel

```bash
# Genera el nuevo hash SHA-256
echo -n "NuevaContraseña" | openssl dgst -sha256 | awk '{print $2}'

# Actualiza el .env
nano /opt/dolibarr-edu/.env
# Cambia ADMIN_PASSWORD_HASH=<hash_nuevo>

# Reinicia el panel
docker compose restart panel
```

### Configuración fiscal

Desde el panel, en **Configuración**, se puede cambiar el régimen fiscal aplicado al crear nuevas entidades:

- **IGIC** (por defecto) — para centros de Canarias
- **IVA** — para centros de la Península y resto del territorio

El régimen se aplica únicamente al crear nuevas entidades; las existentes no se modifican.

---

## Panel de gestión — guía de uso

### Acceso
1. Navega a la URL del centro (ej: `https://panel.micentro.es`)
2. Pulsa **"Acceder al Panel"** o ve directamente a `/login`
3. Introduce la contraseña configurada en la instalación

### Flujo de trabajo recomendado al inicio de curso

1. **Configura el régimen fiscal** — Ve a *Configuración* y comprueba que IGIC o IVA es el correcto para tu centro
2. **Crea los profesores** — Ve a *Profesores → Nuevo profesor*
3. **Crea los grupos** — Ve a *Grupos → Nuevo grupo*, asigna un profesor
4. **Importa los alumnos** — Ve a *Importar* y pega el CSV del listado oficial
5. **Despliega las empresas** — En la ficha de cada alumno (o desde *Estado Dolibarr*) pulsa *Desplegar*

### Formato CSV para importación masiva

```
nombre,apellidos,email,usuario,contraseña,empresa
Carlos,López Martín,carlos.lopez@alumnos.es,carlos.lopez,MiContraseña1!,Comercial López SL
María,Sánchez Ruiz,maria.sanchez@alumnos.es,maria.sanchez,MiContraseña2!,Asesoría Sánchez
```

Los campos mínimos requeridos son `nombre`, `apellidos`, `usuario` y `contraseña`. El campo `empresa` es opcional.

### Restablecer contraseña de un alumno

1. Ve a *Alumnos* y abre la ficha del alumno
2. Pulsa **Restablecer contraseña** en la tarjeta *Entorno de Simulación*
3. Se genera una nueva contraseña aleatoria y se actualiza tanto en la BD como en Dolibarr (si el alumno está desplegado)
4. Anota la nueva contraseña del cuadro que aparece — no se puede recuperar después de cerrarlo

---

## Portal del alumno

Los alumnos acceden a su empresa directamente desde la landing page del centro:

1. El alumno visita la URL del centro
2. En la sección **"Accede a tu empresa"** introduce su usuario y contraseña
3. El sistema muestra su nombre y empresa
4. El botón **"Acceder a mi empresa"** abre directamente su entidad en Dolibarr

> Las credenciales del alumno (usuario y contraseña) las facilita el profesor al inicio del curso. La contraseña se guarda como hash SHA-256 y nunca en texto plano.

---

## Desarrollo local

### Requisitos
- Node.js 24+
- pnpm 9+
- PostgreSQL (o `DATABASE_URL` apuntando a una instancia remota)

### Configuración inicial

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tu DATABASE_URL y SESSION_SECRET

# Crear las tablas en la base de datos
pnpm --filter @workspace/db run push

# (Opcional) Regenerar hooks de API tras cambiar el spec
pnpm --filter @workspace/api-spec run codegen
```

### Arrancar en modo desarrollo

```bash
# Terminal 1 — API server (puerto 8080, ruta /api)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Panel web (puerto 19076, ruta /)
pnpm --filter @workspace/panel run dev
```

### Contraseña del panel en desarrollo

La variable `ADMIN_PASSWORD_HASH` debe contener el hash SHA-256 de tu contraseña de prueba:

```bash
# Hash para la contraseña "admin123"
echo -n "admin123" | openssl dgst -sha256
# → 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
```

Si `ADMIN_PASSWORD_HASH` no está definida, el panel no pide contraseña (modo no configurado).

### Comandos útiles

```bash
pnpm run typecheck                               # Verificación de tipos completa
pnpm run build                                   # Build de todos los paquetes
pnpm --filter @workspace/db run push             # Aplicar cambios de esquema DB
pnpm --filter @workspace/api-spec run codegen    # Regenerar hooks y schemas Zod
```

---

## Estructura del proyecto

```
dolibarr-edu/                   # Paquete de despliegue Docker (servidor escolar)
│   ├── docker-compose.yml      # Dolibarr + MariaDB + Cloudflare Tunnel
│   ├── .env.example            # Plantilla de configuración
│   ├── install.sh              # Instalador de un comando
│   ├── update.sh               # Script de actualización
│   ├── cloudflare/config.yml   # Configuración del túnel Cloudflare
│   └── scripts/                # CLI: setup-inicial, crear-grupo, etc.
│
lib/
│   ├── api-spec/openapi.yaml   # Contrato OpenAPI (fuente de verdad)
│   ├── api-client-react/       # Hooks React Query generados por Orval
│   ├── api-zod/                # Schemas Zod generados por Orval
│   └── db/src/schema/          # Tablas Drizzle ORM
│       ├── teachers.ts         # Profesores
│       ├── groups.ts           # Grupos
│       ├── students.ts         # Alumnos + estado sincronización Dolibarr
│       ├── employees.ts        # Empleados para nóminas
│       ├── payrolls.ts         # Nóminas mensuales
│       ├── ss-payments.ts      # Liquidaciones SS/IRPF por período
│       ├── settings.ts         # Configuración del panel (clave/valor)
│       └── activity-logs.ts    # Historial de actividad
│
artifacts/
│   ├── api-server/src/
│   │   ├── routes/             # teachers, groups, students, stats, auth,
│   │   │                       # deploy, employees, payrolls, ss,
│   │   │                       # settings, reset-password, activity
│   │   ├── middleware/         # requireAuth
│   │   └── lib/                # dolibarr.ts, activity.ts, auth.ts, logger
│   └── panel/src/
│       ├── pages/
│       │   ├── landing.tsx     # Portal público del alumno
│       │   ├── login.tsx       # Login del profesorado
│       │   ├── dashboard/      # Estadísticas generales
│       │   ├── profesores/     # CRUD profesores
│       │   ├── grupos/         # CRUD grupos
│       │   ├── alumnos/        # CRUD alumnos + exportar CSV + reset password
│       │   ├── importar/       # Importación masiva CSV
│       │   ├── nominas/        # Nóminas, empleados, SS/IRPF
│       │   ├── estado/         # Estado sincronización Dolibarr
│       │   ├── actividad/      # Historial de actividad
│       │   └── configuracion/  # Régimen fiscal, moneda, idioma
│       ├── components/         # AppLayout (sidebar), shadcn/ui
│       └── contexts/           # AuthContext
│
screenshots/
│   ├── landing.jpg             # Página pública de inicio
│   └── login.jpg               # Login del panel de gestión
```

---

## API

Base URL: `/api`

La especificación completa está en `lib/api-spec/openapi.yaml`.

### Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/healthz` | Estado del servidor |
| `POST` | `/api/auth/login` | Login del panel (devuelve token) |
| `POST` | `/api/auth/student-login` | Login del alumno (devuelve URL empresa) |
| `GET` | `/api/teachers` | Listar profesores |
| `POST` | `/api/teachers` | Crear profesor |
| `GET/PUT/DELETE` | `/api/teachers/:id` | Detalle, actualizar, eliminar |
| `GET` | `/api/groups` | Listar grupos |
| `POST` | `/api/groups` | Crear grupo |
| `GET/PUT/DELETE` | `/api/groups/:id` | Detalle, actualizar, eliminar |
| `GET` | `/api/students` | Listar alumnos (búsqueda + filtro por grupo) |
| `POST` | `/api/students` | Crear alumno |
| `POST` | `/api/students/bulk` | Importación masiva |
| `GET/PUT/DELETE` | `/api/students/:id` | Detalle, actualizar, eliminar |
| `POST` | `/api/students/:id/deploy` | Desplegar empresa en Dolibarr |
| `POST` | `/api/students/:id/reset-password` | Restablecer contraseña |
| `GET` | `/api/employees` | Listar empleados |
| `POST` | `/api/employees` | Crear empleado |
| `GET/PUT/DELETE` | `/api/employees/:id` | Detalle, actualizar, eliminar |
| `GET` | `/api/payrolls` | Listar nóminas |
| `POST` | `/api/payrolls` | Crear nómina |
| `GET/DELETE` | `/api/payrolls/:id` | Detalle, eliminar |
| `POST` | `/api/payrolls/:id/sync-dolibarr` | Sincronizar nómina con Dolibarr |
| `GET` | `/api/ss/payments` | Listar liquidaciones SS |
| `POST` | `/api/ss/pay-ss` | Asiento pago SS a Tesorería |
| `POST` | `/api/ss/pay-irpf` | Asiento pago IRPF a Hacienda |
| `GET` | `/api/stats` | Estadísticas globales |
| `GET/PUT` | `/api/settings` | Configuración fiscal del panel |
| `GET` | `/api/activity` | Historial de actividad |

Todos los endpoints excepto `/healthz`, `/auth/login` y `/auth/student-login` requieren cabecera `Authorization: Bearer <token>`.

---

## Seguridad

- **Contraseña del panel:** almacenada como hash SHA-256, nunca en texto plano. El token de sesión se genera con HMAC-SHA256 firmado con `SESSION_SECRET`.
- **Contraseñas de alumnos:** almacenadas como hash SHA-256 (compatibles con la API de Dolibarr).
- **Comparación segura:** se usa `timingSafeEqual` para evitar ataques de temporización.
- **Cloudflare Tunnel:** el servidor escolar no abre ningún puerto a internet; todo el tráfico pasa por el túnel cifrado de Cloudflare.
- **Sin root:** el instalador rechaza ejecutarse como root y usa `sudo` solo donde es necesario.

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| ERP | Dolibarr 18+ (módulo multi-empresa) |
| Contenedores | Docker + Docker Compose |
| Túnel HTTPS | Cloudflare Tunnel |
| API | Node.js 24, Express 5, TypeScript |
| Base de datos | PostgreSQL + Drizzle ORM |
| Validación | Zod v4, drizzle-zod |
| Codegen | Orval (OpenAPI → hooks + Zod) |
| Frontend | React 19, Vite 7, Tailwind CSS, shadcn/ui |
| Estado servidor | TanStack Query v5 |
| Routing | Wouter |

---

## Repositorio

[https://github.com/innovafpiesmmg/Dolibarr-Edu](https://github.com/innovafpiesmmg/Dolibarr-Edu)

---

## Créditos y licencia

Desarrollado por **Atreyu Servicios Digitales (ASD)**.

Basado en [Dolibarr ERP/CRM](https://www.dolibarr.org), software libre bajo licencia GPLv3.
