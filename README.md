# ERP EDU

![ERP EDU Logo](artifacts/panel/public/images/logo.png)

Plataforma de gestión educativa para centros de **Formación Profesional de Administración de Empresas**. Proporciona a cada alumno una empresa ERP real e independiente, con profesores gestionando grupos y alumnos desde un panel centralizado.

Un proyecto del **Departamento de Administración de empresas del IES Manuel Martín González**.

Desarrollado por **Atreyu Servicios Digitales (ASD)** · [GitHub](https://github.com/innovafpiesmmg/Dolibarr-Edu)

---

## Capturas de pantalla

### Página de inicio — acceso del alumno a su empresa
![Landing page](screenshots/landing.jpg)

### Panel de gestión — acceso del profesorado
![Panel de gestión](screenshots/login.jpg)

---

## Índice

1. [Descripción general](#descripción-general)
2. [Ecosistema de herramientas](#ecosistema-de-herramientas)
3. [Características](#características)
4. [Módulo NominasEDU (Dolibarr nativo)](#módulo-nominasedu-dolibarr-nativo)
5. [Arquitectura](#arquitectura)
6. [Instalación en servidor del centro](#instalación-en-servidor-del-centro)
7. [Actualización](#actualización)
8. [Configuración](#configuración)
9. [Panel de gestión — guía de uso](#panel-de-gestión--guía-de-uso)
10. [Portal del alumno](#portal-del-alumno)
11. [Desarrollo local](#desarrollo-local)
12. [Estructura del proyecto](#estructura-del-proyecto)
13. [API](#api)
14. [Seguridad](#seguridad)
15. [Tecnologías](#tecnologías)

---

## Descripción general

ERP EDU resuelve el principal reto de la FP de Administración: proporcionar a cada alumno un entorno de trabajo profesional real e independiente, sin licencias comerciales ni infraestructura compleja.

Cada alumno recibe en un único servidor:
- **Su empresa en Dolibarr ERP** — facturación, contabilidad, RRHH, inventario, CRM
- **Espacio en OpenProject** — gestión de proyectos con Gantt, tareas y registro de horas
- **Suite ofimática en el navegador** — Writer, Calc e Impress a través de Collabora Online

El profesorado gestiona grupos, alumnos, accesos y nóminas desde un panel web centralizado protegido con contraseña.

---

## Ecosistema de herramientas

ERP EDU despliega tres herramientas de nivel profesional en el mismo servidor, accesibles cada una desde su propio subdominio mediante un túnel Cloudflare:

| Herramienta | Subdominio | Función |
|-------------|------------|---------|
| **Dolibarr ERP/CRM** | `erp.micentro.es` | ERP multiempresa — una empresa por alumno |
| **OpenProject** | `proyectos.micentro.es` | Gestión de proyectos: Gantt, tareas, horas |
| **LibreOffice Online** | `office.micentro.es` | Suite ofimática en el navegador (Collabora) |

### Dolibarr ERP/CRM
El núcleo del sistema. Cada alumno opera una entidad Dolibarr completamente aislada con el mismo software que usan más de 250 000 pymes en todo el mundo. Incluye el **módulo PHP nativo NominasEDU** para prácticas de nóminas y Seguridad Social directamente dentro del ERP.

### OpenProject
Gestión de proyectos al nivel de herramientas profesionales como Jira o Monday. Los alumnos planifican tareas, registran horas y visualizan el progreso en diagramas de Gantt. Edición Community — completamente gratuita.

**Funcionalidades principales:**
- Diagramas de Gantt y tableros de tareas
- Registro y seguimiento de horas
- Gestión de miembros con roles diferenciados
- Roadmaps y seguimiento de versiones

### LibreOffice Online (Collabora)
Suite ofimática completa en el navegador sin necesidad de instalar nada. Compatible con formatos .docx, .xlsx y .pptx. Integrable directamente con Dolibarr para abrir documentos adjuntos en el navegador, y con OpenProject para editar documentos de los proyectos.

**Aplicaciones incluidas:**
- **Writer** — procesador de textos
- **Calc** — hoja de cálculo
- **Impress** — presentaciones

---

## Características

### Panel de gestión
- **Dashboard** con estadísticas en tiempo real: total de profesores, grupos, alumnos y distribución por grupo
- **Gestión de profesores** — alta, edición y baja con conteo de grupos y alumnos asignados
- **Gestión de grupos** — CRUD completo con asignación de profesor responsable
- **Gestión de alumnos** — búsqueda, filtrado por grupo, alta, edición y baja
- **Exportar CSV** — descarga el listado completo de alumnos en formato Excel-compatible
- **Importación masiva** — carga de alumnos por CSV con resumen de errores
- **Restablecer contraseña** — genera una nueva contraseña para cualquier alumno y la sincroniza con Dolibarr

### Módulo de nóminas (panel Node.js)
- **Empleados** — vincula empleados del centro a alumnos para las prácticas de nóminas
- **Nueva nómina** — cálculo completo (salario bruto, IRPF, cuotas SS obrero/empresa con tipos 2024)
- **Detalle de nómina** — consulta y sincronización del asiento contable 640/642/465/476/4751 con Dolibarr HRM
- **Liquidaciones SS** — generación de RNT y RLC, asientos pago a Tesorería (476→572) y a Hacienda — Modelo 111 (4751→572)

### Sincronización con Dolibarr
- **Estado de sincronización** (`/estado`) — vista global con filtros por estado, botón de reintento e indicador de errores
- **Despliegue automático** — crea entidad empresa, usuario ERP y configura régimen fiscal (IGIC/IVA)

### Administración
- **Historial de actividad** (`/actividad`) — registro cronológico de todas las acciones del panel
- **Configuración fiscal** (`/configuracion`) — régimen IGIC/IVA, moneda e idioma aplicados al crear entidades

### Portal del alumno (landing page)
- Formulario de acceso con usuario y contraseña en la página pública
- Muestra nombre, empresa y grupo al autenticarse
- Acceso directo a la empresa en Dolibarr, a OpenProject y a LibreOffice Online

---

## Módulo NominasEDU (Dolibarr nativo)

**NominasEDU** es un módulo PHP real para Dolibarr. Aparece en el menú principal del ERP como cualquier otro módulo oficial (junto a Facturas, Contabilidad, RRHH…) y utiliza la interfaz y el estilo visual nativos de Dolibarr.

### Páginas del módulo

| Página | Descripción |
|--------|-------------|
| **Lista de nóminas** | Nóminas del período seleccionado con totales de masa salarial, SS y coste empresa |
| **Nueva nómina** | Formulario con cálculo en tiempo real de IRPF, SS y neto al teclear |
| **Detalle de nómina** | Desglose completo con tabla de tipos SS 2024 partida a partida |
| **Empleados** | Alta, edición y baja de empleados vinculados a usuarios Dolibarr |
| **Liquidación SS/IRPF** | Totales mensuales y registro de fechas de pago a Tesorería y Hacienda |

### Tipos SS aplicados (Régimen General 2024)

| Concepto | Obrero | Empresa |
|----------|--------|---------|
| Contingencias comunes | 4,70% | 23,60% |
| Desempleo | 1,55% | 5,50% |
| Formación profesional | 0,10% | 0,60% |
| FOGASA | — | 0,20% |
| MEI | 0,12% | 0,58% |
| **Total** | **6,47%** | **30,48%** |

### Instalación del módulo

El módulo se instala automáticamente con el despliegue: `docker-compose.yml` monta `dolibarr-edu/modules/` en `/var/www/html/custom/` del contenedor.

Para activarlo (una sola vez tras el primer arranque):
> **Dolibarr → Configuración → Módulos/Aplicaciones → pestaña Recursos humanos → NominasEDU → Activar**

Dolibarr crea automáticamente las tres tablas necesarias: `llx_nominasedu_employee`, `llx_nominasedu_payroll`, `llx_nominasedu_ss_payment`.

### Permisos del módulo

| Permiso | Descripción | Por defecto |
|---------|-------------|-------------|
| `nominasedu.read` | Consultar nóminas y empleados | Activado |
| `nominasedu.write` | Crear y editar nóminas y empleados | Desactivado |
| `nominasedu.delete` | Eliminar registros | Desactivado |

---

## Arquitectura

```
Internet
   │
   ▼
Cloudflare Tunnel (HTTPS sin abrir puertos)
   │
   ├── erp.micentro.es        → Dolibarr ERP (puerto 8069)
   ├── proyectos.micentro.es  → OpenProject   (puerto 8070)
   └── office.micentro.es     → Collabora     (puerto 9980)
          │
          ▼
Servidor del centro (Ubuntu/Debian)
   ├── dolibarr     — Dolibarr ERP/CRM (módulo NominasEDU incluido)
   ├── db           — MariaDB (base de datos de Dolibarr)
   ├── openproject  — Gestión de proyectos
   ├── openproject_db — PostgreSQL (base de datos de OpenProject)
   ├── collabora    — Collabora Online / LibreOffice en el navegador
   └── Panel EDU    — Node.js + PostgreSQL
          ├── API REST (/api)   ← Express + Drizzle ORM
          └── Frontend (/)      ← React + Vite
```

**Modelo multi-empresa:** El módulo nativo `modMultiCompany` de Dolibarr aísla completamente cada empresa de alumno. Ningún alumno puede ver los datos de otro.

---

## Instalación en servidor del centro

### Requisitos previos
- Ubuntu 22.04 / Debian 12 (o compatible)
- Usuario con `sudo` (NO ejecutar como root)
- Conexión a internet
- Mínimo 4 GB de RAM recomendados (OpenProject es el servicio más exigente)

---

### Paso 0 — Preparar el servidor Ubuntu

Antes de instalar ERP EDU, actualiza el sistema e instala las herramientas básicas:

```bash
# 1. Actualizar la lista de paquetes y el sistema completo
sudo apt-get update && sudo apt-get upgrade -y

# 2. Instalar git, curl y openssl (necesarios para el instalador)
sudo apt-get install -y git curl openssl

# 3. Reiniciar si hay actualizaciones del kernel (recomendado)
sudo reboot
```

> Si tu servidor es de nueva instalación, también puedes instalar `nano` para editar ficheros fácilmente:
> ```bash
> sudo apt-get install -y nano
> ```

---

### Paso 1 — Instalación con un comando

Una vez preparado el servidor, ejecuta el instalador:

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/install.sh | bash
```

El script realiza automáticamente:
1. Comprueba e instala `git`, `curl` y `openssl` si faltan
2. Instala Docker Engine si no está presente
3. Clona el repositorio en `/opt/dolibarr-edu`
4. **Genera contraseñas aleatorias** para todas las bases de datos y servicios
5. **Solicita la contraseña del panel** de gestión (dos veces para confirmar)
6. **Solicita los dominios públicos** de cada servicio (Dolibarr, OpenProject, LibreOffice)
7. Muestra un resumen de todas las credenciales generadas

> Si Docker acaba de instalarse, el script te pedirá que cierres sesión y vuelvas a entrar antes de continuar. También puedes ejecutar `newgrp docker` sin cerrar sesión.

---

### Paso 2 — Arrancar los servicios

```bash
cd /opt/dolibarr-edu && docker compose up -d
```

Sigue el arranque de OpenProject (la primera vez ejecuta migraciones de base de datos y tarda ~3 minutos):

```bash
docker compose logs -f openproject
# Ctrl+C cuando veas algo como "listening on http://0.0.0.0:80"
```

---

### Paso 3 — Configurar el túnel Cloudflare

Edita `cloudflare/config.yml` con el UUID de tu túnel y los dominios reales del centro:

```bash
nano /opt/dolibarr-edu/cloudflare/config.yml
```

Crea tres registros CNAME en tu zona DNS de Cloudflare, todos apuntando al mismo UUID del túnel:

| Subdominio | Tipo | Destino |
|------------|------|---------|
| `erp.micentro.es` | CNAME | `TU_UUID.cfargotunnel.com` |
| `proyectos.micentro.es` | CNAME | `TU_UUID.cfargotunnel.com` |
| `office.micentro.es` | CNAME | `TU_UUID.cfargotunnel.com` |

Reinicia el túnel para que aplique la nueva configuración:

```bash
cd /opt/dolibarr-edu && docker compose restart cloudflared
```

---

### Paso 4 — Configuración inicial del entorno educativo

```bash
cd /opt/dolibarr-edu && ./scripts/setup-inicial.sh
```

---

### Paso 5 — Activar el módulo NominasEDU en Dolibarr

Una sola vez, desde el navegador:

> **Dolibarr → Configuración → Módulos/Aplicaciones → pestaña Recursos humanos → NominasEDU → Activar**

---

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

El archivo `.env` en `/opt/dolibarr-edu/.env` contiene todas las variables:

### Dolibarr y base de datos

| Variable | Descripción |
|----------|-------------|
| `MYSQL_ROOT_PASSWORD` | Contraseña root de MariaDB |
| `MYSQL_DATABASE` | Nombre de la base de datos de Dolibarr |
| `MYSQL_USER` / `MYSQL_PASSWORD` | Usuario de la base de datos |
| `DOLI_URL_ROOT` | URL pública de Dolibarr (ej: `https://erp.micentro.es`) |
| `DOLI_DOMAIN` | Dominio sin protocolo (ej: `erp.micentro.es`) |
| `DOLI_ADMIN_LOGIN` / `DOLI_ADMIN_PASSWORD` | Cuenta de superadmin de Dolibarr |
| `DOLI_ADMIN_EMAIL` | Email del superadmin |
| `DOLI_COMPANY_NAME` | Nombre del centro (aparece en la cabecera del ERP) |
| `APP_PORT` | Puerto local de Dolibarr (por defecto `8069`) |

### OpenProject

| Variable | Descripción |
|----------|-------------|
| `OP_HOST` | Dominio público de OpenProject (ej: `proyectos.micentro.es`) |
| `OP_DB_PASSWORD` | Contraseña de la base de datos PostgreSQL de OpenProject |
| `OP_SECRET_KEY` | Clave secreta Rails (genera con `openssl rand -hex 64`) |
| `OP_PORT` | Puerto local (por defecto `8070`) |

### Collabora Online

| Variable | Descripción |
|----------|-------------|
| `COLLABORA_ADMIN` | Usuario del panel de admin de Collabora |
| `COLLABORA_PASSWORD` | Contraseña del panel de admin de Collabora |
| `COLLABORA_PORT` | Puerto local (por defecto `9980`) |

### Panel EDU (Node.js)

| Variable | Descripción |
|----------|-------------|
| `ADMIN_PASSWORD_HASH` | Hash SHA-256 de la contraseña del panel |
| `SESSION_SECRET` | Clave secreta para firmar tokens de sesión |
| `DOLIBARR_BASE_URL` | URL pública de Dolibarr (misma que `DOLI_URL_ROOT`) |
| `DOLIBARR_API_KEY` | Clave API del administrador de Dolibarr |
| `DATABASE_URL` | Cadena de conexión PostgreSQL del panel EDU |

### Cambiar la contraseña del panel

```bash
# Genera el nuevo hash SHA-256
echo -n "NuevaContraseña" | openssl dgst -sha256 | awk '{print $2}'

# Actualiza el .env y reinicia el panel
nano /opt/dolibarr-edu/.env
docker compose restart panel
```

### Configuración fiscal

Desde el panel, en **Configuración**, puedes cambiar el régimen fiscal aplicado al crear nuevas entidades:
- **IGIC** (por defecto) — para centros de Canarias
- **IVA** — para centros de la Península y resto del territorio

El régimen se aplica únicamente al crear nuevas entidades; las existentes no se modifican.

---

## Panel de gestión — guía de uso

### Acceso
1. Navega a la URL del centro (ej: `https://panel.micentro.es` o la raíz `/`)
2. Pulsa **"Panel de gestión"** o ve directamente a `/login`
3. Introduce la contraseña configurada en la instalación

### Flujo de trabajo al inicio de curso

1. **Configura el régimen fiscal** — Ve a *Configuración* y comprueba IGIC o IVA
2. **Crea los profesores** — Ve a *Profesores → Nuevo profesor*
3. **Crea los grupos** — Ve a *Grupos → Nuevo grupo*, asigna un profesor
4. **Importa los alumnos** — Ve a *Importar* y pega el CSV del listado oficial
5. **Despliega las empresas** — En *Estado Dolibarr* pulsa *Desplegar* por alumno o en lote
6. **Activa NominasEDU** — En Dolibarr admin, activa el módulo (solo una vez)
7. **Crea empleados en NominasEDU** — Vincula usuarios Dolibarr como empleados para las prácticas de nóminas

### Formato CSV para importación masiva

```
nombre,apellidos,email,usuario,contraseña,empresa
Carlos,López Martín,carlos.lopez@alumnos.es,carlos.lopez,MiContraseña1!,Comercial López SL
María,Sánchez Ruiz,maria.sanchez@alumnos.es,maria.sanchez,MiContraseña2!,Asesoría Sánchez
```

Los campos mínimos son `nombre`, `apellidos`, `usuario` y `contraseña`. El campo `empresa` es opcional.

### Restablecer contraseña de un alumno

1. Ve a *Alumnos* y abre la ficha del alumno
2. Pulsa **Restablecer contraseña** en la tarjeta *Entorno de Simulación*
3. Se genera una nueva contraseña aleatoria, se actualiza en la BD y en Dolibarr
4. Anota la nueva contraseña — no se puede recuperar después de cerrarlo

---

## Portal del alumno

Los alumnos acceden desde la landing page del centro:

1. El alumno visita la URL del centro
2. En **"Accede a tu empresa"** introduce su usuario y contraseña
3. El sistema muestra su nombre, empresa y grupo
4. El botón **"Acceder a mi empresa"** abre directamente su entidad en Dolibarr

Desde el pie de la landing y la barra lateral del panel, el alumno también tiene acceso directo a **OpenProject** (`proyectos.micentro.es`) y **LibreOffice Online** (`office.micentro.es`).

> Las credenciales del alumno (usuario y contraseña) las facilita el profesor al inicio del curso. La contraseña se almacena como hash SHA-256, nunca en texto plano.

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
dolibarr-edu/                        # Paquete de despliegue Docker
│   ├── docker-compose.yml           # Dolibarr + MariaDB + OpenProject +
│   │                                # PostgreSQL + Collabora + Cloudflare Tunnel
│   ├── .env.example                 # Plantilla de configuración completa
│   ├── install.sh                   # Instalador de un comando
│   ├── update.sh                    # Script de actualización con backup
│   ├── cloudflare/config.yml        # Túnel: erp / proyectos / office
│   ├── scripts/                     # CLI: setup-inicial, crear-grupo, etc.
│   └── modules/nominasedu/          # Módulo PHP nativo para Dolibarr
│       ├── core/modules/            # Descriptor del módulo (menús, permisos)
│       ├── langs/es_ES/             # Cadenas en español
│       ├── sql/                     # Tablas llx_nominasedu_*
│       ├── lib/                     # Helpers: cálculo nómina, BD, badges
│       ├── index.php                # Lista de nóminas del período
│       ├── nomina_card.php          # Crear / ver / validar nómina
│       ├── empleados.php            # CRUD empleados
│       └── ss.php                   # Liquidación SS/IRPF
│
lib/
│   ├── api-spec/openapi.yaml        # Contrato OpenAPI (fuente de verdad)
│   ├── api-client-react/            # Hooks React Query generados por Orval
│   ├── api-zod/                     # Schemas Zod generados por Orval
│   └── db/src/schema/               # Tablas Drizzle ORM
│       ├── teachers.ts
│       ├── groups.ts
│       ├── students.ts
│       ├── employees.ts
│       ├── payrolls.ts
│       ├── ss-payments.ts
│       ├── settings.ts
│       └── activity-logs.ts
│
artifacts/
│   ├── api-server/src/
│   │   ├── routes/                  # teachers, groups, students, stats, auth,
│   │   │                            # deploy, employees, payrolls, ss,
│   │   │                            # settings, reset-password, activity
│   │   ├── middleware/              # requireAuth
│   │   └── lib/                    # dolibarr.ts, activity.ts, auth.ts, logger
│   └── panel/src/
│       ├── pages/
│       │   ├── landing.tsx          # Portal público + acceso a las 3 herramientas
│       │   ├── login.tsx
│       │   ├── dashboard/
│       │   ├── profesores/
│       │   ├── grupos/
│       │   ├── alumnos/             # CRUD + exportar CSV + reset password
│       │   ├── importar/
│       │   ├── nominas/             # Nóminas, empleados, SS/IRPF
│       │   ├── estado/              # Estado sincronización Dolibarr
│       │   ├── actividad/
│       │   └── configuracion/
│       ├── components/
│       │   └── layout/AppLayout.tsx # Sidebar con enlaces a las 3 herramientas
│       └── contexts/AuthContext.tsx
│
screenshots/
│   ├── landing.jpg
│   └── login.jpg
```

---

## API

Base URL: `/api` · Especificación completa: `lib/api-spec/openapi.yaml`

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
| `GET` | `/api/students` | Listar alumnos (búsqueda + filtro) |
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

Todos los endpoints excepto `/healthz`, `/auth/login` y `/auth/student-login` requieren `Authorization: Bearer <token>`.

---

## Seguridad

- **Contraseña del panel:** almacenada como hash SHA-256. El token de sesión se genera con HMAC-SHA256 firmado con `SESSION_SECRET`.
- **Contraseñas de alumnos:** almacenadas como hash SHA-256 (compatibles con la API de Dolibarr).
- **Comparación segura:** `timingSafeEqual` para evitar ataques de temporización.
- **Cloudflare Tunnel:** el servidor no abre ningún puerto a internet; todo el tráfico pasa por el túnel cifrado de Cloudflare.
- **Sin root:** el instalador rechaza ejecutarse como root y usa `sudo` solo donde es necesario.
- **Redes Docker:** todos los servicios se comunican en una red interna (`dolibarr_net`) sin exposición directa al exterior.

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| ERP | Dolibarr 18+ (módulo multi-empresa) + módulo PHP NominasEDU |
| Proyectos | OpenProject 15 Community |
| Ofimática | Collabora Online / LibreOffice Online |
| Contenedores | Docker + Docker Compose |
| Túnel HTTPS | Cloudflare Tunnel |
| API | Node.js 24, Express 5, TypeScript |
| Base de datos | PostgreSQL + Drizzle ORM (panel) · MariaDB (Dolibarr) · PostgreSQL (OpenProject) |
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

Basado en software libre:
- [Dolibarr ERP/CRM](https://www.dolibarr.org) — GPLv3
- [OpenProject](https://www.openproject.org) — GPLv3
- [Collabora Online](https://www.collaboraoffice.com) — MPLv2
