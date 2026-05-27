# ERP EDU — Guía de despliegue en servidor

Paquete Docker completo para desplegar ERP EDU en el servidor del centro.

---

## Índice

1. [Arquitectura](#arquitectura)
2. [Requisitos del servidor](#requisitos-del-servidor)
3. [Instalación](#instalación)
4. [Configurar Cloudflare Tunnel](#configurar-cloudflare-tunnel)
5. [Variables de entorno](#variables-de-entorno)
6. [Gestión de contenedores](#gestión-de-contenedores)
7. [Copias de seguridad](#copias-de-seguridad)
8. [Resolución de problemas](#resolución-de-problemas)

---

## Arquitectura

```
Internet
   │
   ▼
Cloudflare Tunnel
   │
   ├── panel.micentro.es           → panel_web:80    (nginx + React)
   └── *.erp.micentro.es (wildcard) → traefik:80     (un contenedor por alumno)

Servidor Ubuntu/Debian — red Docker interna (dolibarr_net)
   ├── cloudflared                ← cliente del túnel Cloudflare
   ├── panel_web                  ← nginx sirviendo React + proxy /api → panel_api
   ├── panel_api                  ← Node.js/Express; orquesta los contenedores vía /var/run/docker.sock
   ├── panel_db                   ← PostgreSQL exclusiva del panel
   ├── traefik                    ← reverse proxy por subdominio <alumno>.erp.micentro.es
   ├── db                         ← MariaDB compartida (una BD por alumno)
   └── dolibarr_alu_<usuario>     ← un contenedor Dolibarr aislado por alumno
```

Cada alumno tiene su propio contenedor Dolibarr y su propia base de datos en la MariaDB compartida. El panel los crea, arranca, detiene y elimina bajo demanda.

---

## Requisitos del servidor

| Componente | Mínimo recomendado |
|---|---|
| SO | Ubuntu 22.04 LTS o Debian 12 |
| CPU | 2 cores |
| RAM | **16 GB** (soporta hasta ~30 contenedores Dolibarr simultáneos) |
| Disco | 40 GB |
| Software | Docker 24+ y Docker Compose 2+ |
| Red | Conexión a internet; NO es necesario abrir puertos |

---

## Preparar el servidor

Antes de instalar ERP EDU, actualiza el sistema e instala las herramientas básicas. Conéctate al servidor por SSH y ejecuta:

```bash
# 1. Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar git, curl y openssl (necesarios para el instalador)
sudo apt install -y git curl openssl

# 3. Reiniciar si hubo actualizaciones del kernel (recomendado)
sudo reboot
```

Tras el reinicio, vuelve a conectarte por SSH. El instalador se encargará de instalar Docker automáticamente si no está presente.

---

## Instalación

### Opción A — Instalador automático (recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/install.sh | bash
```

El instalador:
- Instala Docker si no está presente
- Clona el repositorio en `/opt/dolibarr-edu`
- Genera contraseñas aleatorias para todos los servicios
- Pide la contraseña del panel, el dominio base de los alumnos y el token de Cloudflare
- Ofrece construir y arrancar todos los servicios automáticamente

### Opción B — Manual

```bash
# 1. Clonar
git clone https://github.com/innovafpiesmmg/Dolibarr-Edu /opt/dolibarr-edu
cd /opt/dolibarr-edu/dolibarr-edu

# 2. Crear .env
cp .env.example .env
nano .env   # rellena todos los valores

# 3. Construir las imágenes del panel (~5-10 min la primera vez)
docker compose build panel_api panel_web

# 4. Arrancar
docker compose up -d
docker compose ps
```

---

## Configurar Cloudflare Tunnel

Cloudflare Tunnel publica el panel y los Dolibarr de los alumnos en Internet **sin abrir puertos** en el cortafuegos del centro. Solo dos public hostnames y dos registros DNS bastan para todo.

### Requisitos previos

- Una cuenta de Cloudflare con el **dominio** (ej. `micentro.es`) ya añadido y con los **nameservers de Cloudflare activos** (en estado *Active* en la sección Overview del dominio).
- El plan **Free** es suficiente. El SSL Universal (gratuito) cubre `*.micentro.es` (un nivel de subdominio) automáticamente.

> ⚠ **Sobre la profundidad del wildcard:** SSL Universal **solo cubre un nivel** (`*.micentro.es` ✅) pero **no dos** (`*.erp.micentro.es` ❌, daría error de certificado). Si quieres aislar los alumnos en un subdominio propio (`<alumno>.erp.micentro.es`), necesitas el **Advanced Certificate Manager** de Cloudflare (de pago) o un certificado Let's Encrypt wildcard. La configuración recomendada y por defecto en este paquete es **`<alumno>.micentro.es`** (un nivel).

### Paso 1 — Crear el túnel

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com) → **Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Tipo: **Cloudflared**. Nombre sugerido: `dolibarr-edu` (o el nombre del centro).
3. En la pantalla siguiente verás un comando de instalación con un token largo:
   ```
   docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoi...
   ```
   **Copia solo el token** (la cadena que empieza por `eyJ`).
4. Apunta también el **UUID del túnel** — lo verás en la URL del navegador (`.../tunnels/<UUID>/...`) y en los logs de `cloudflared`. Lo necesitarás para el registro DNS del wildcard.

### Paso 2 — Guardar el token y arrancar el túnel

```bash
cd /opt/dolibarr-edu/dolibarr-edu

# Editar .env y poner el token
nano .env
# CLOUDFLARE_TOKEN=eyJhIjoi...

# Arrancar el túnel (el perfil "cloudflare" del compose)
docker compose --profile cloudflare up -d cloudflared
sleep 5
docker compose logs cloudflared --tail=15
```

Debes ver líneas como:
```
INF Starting tunnel tunnelID=5998e43b-...
INF Registered tunnel connection connIndex=0 ...
```

El `tunnelID` que aparece **debe coincidir** con el UUID que viste en el dashboard. Si no coincide, el token pertenece a otro túnel — vuelve al Paso 1 y copia el token correcto.

### Paso 3 — Public Hostnames (en el túnel)

En el dashboard de Cloudflare → tu túnel → **Public Hostname → Add a public hostname**. Añade **exactamente estas dos entradas** (asumiendo dominio `micentro.es`; sustituye por el tuyo):

| Subdominio | Dominio | Path | Type | Service URL |
|---|---|---|---|---|
| `panel` | `micentro.es` | *(vacío)* | HTTP | `panel_web:80` |
| `*` | `micentro.es` | *(vacío)* | HTTP | `traefik:80` |

- `panel.micentro.es` → panel de gestión + landing.
- `*.micentro.es` → cualquier `<alumno>.micentro.es` cae en Traefik, que enruta al contenedor Dolibarr correcto por subdominio.

> Las URLs internas (`panel_web`, `traefik`) son los **nombres de servicio del `docker-compose.yml`**, no nombres de contenedor ni IPs. Funcionan porque `cloudflared` está en la misma red Docker (`dolibarr_net`).

### Paso 4 — Registros DNS (¡este es el paso que suele faltar!)

Cloudflare crea **automáticamente** el registro DNS para subdominios concretos como `panel`, pero **NO para wildcards**. Hay que crear el `*` a mano.

En **Dashboard → tu dominio → DNS → Records**, comprueba/crea estos registros:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `panel` | `<UUID>.cfargotunnel.com` | 🟠 Proxied |
| CNAME | `*` | `<UUID>.cfargotunnel.com` | 🟠 Proxied |

Donde `<UUID>` es el ID del túnel (ej. `5998e43b-736a-4c36-ad78-5019356d0c09`).

> ⚠ **Error frecuente:** dejar el wildcard como `CNAME * → micentro.es` (apuntando al propio dominio). Cloudflare lo acepta sin error pero las peticiones nunca llegan al túnel → da **error 524** silencioso y `cloudflared` no muestra tráfico en sus logs. **El destino tiene que ser `<UUID>.cfargotunnel.com`.**

### Paso 5 — Verificar de extremo a extremo

```bash
# 1) El túnel está conectado
docker compose logs cloudflared --tail=10 | grep "Registered tunnel"

# 2) El panel responde localmente
curl -sI http://localhost:${PANEL_PORT:-8068} | head -1

# 3) Traefik enruta correctamente al contenedor de un alumno
sudo docker run --rm --network dolibarr_net alpine \
  wget -qO- --timeout=5 -S --header="Host: <alumno>.micentro.es" \
  http://traefik:80/ 2>&1 | head -3
```

Y desde fuera (navegador o `curl`):
- `https://panel.micentro.es/` → carga la landing y el panel.
- `https://<alumno>.micentro.es/` → carga el Dolibarr del alumno (tras haberlo desplegado desde el panel).

### Configuración en el panel

Tras configurar Cloudflare, entra en el panel → **Configuración** y asegúrate de que el campo **Dominio base** vale `micentro.es` (el mismo dominio que has usado en los registros DNS). El panel usa ese valor para generar la URL pública de cada alumno y para escribir las reglas de Traefik.

---

## Variables de entorno

Fichero: `/opt/dolibarr-edu/dolibarr-edu/.env`

```bash
# ── MariaDB compartida (una BD por alumno) ──────────────
MYSQL_ROOT_PASSWORD=...

# ── Dominio base de los alumnos ─────────────────────────
# Cada alumno será accesible en https://<usuario>.<BASE_DOMAIN>/
BASE_DOMAIN=erp.micentro.es
TRAEFIK_PORT=8090

# ── Panel EDU (Node.js) ─────────────────────────────────
PANEL_URL=https://panel.micentro.es
PANEL_DB_PASSWORD=...
ADMIN_PASSWORD_HASH=<sha256 de la contraseña del panel>
SESSION_SECRET=...
PANEL_PORT=8068

# ── Cloudflare Tunnel ───────────────────────────────────
CLOUDFLARE_TOKEN=eyJhIjoiMT...
```

### Cambiar la contraseña del panel

```bash
# Generar hash SHA-256
echo -n "NuevaContraseña" | openssl dgst -sha256 | awk '{print $2}'

# Actualizar .env
sed -i "s|^ADMIN_PASSWORD_HASH=.*|ADMIN_PASSWORD_HASH=<hash>|" .env

# Aplicar
docker compose restart panel_api
```

---

## Gestión de contenedores

```bash
# Ver estado de todos los servicios
docker compose ps

# Ver logs de un servicio
docker compose logs -f panel_api
docker compose logs -f traefik
docker compose logs -f db

# Reiniciar un servicio
docker compose restart panel_web

# Reconstruir imágenes del panel (tras actualización)
docker compose build panel_api panel_web
docker compose up -d panel_api panel_web

# Ver contenedores Dolibarr de alumnos
docker ps --filter "name=dolibarr_alu_"

# Parar todo
docker compose down

# Parar todo y eliminar volúmenes (¡BORRA DATOS!)
docker compose down -v
```

---

## Copias de seguridad

```bash
# Backup de TODAS las bases de datos de alumnos (MariaDB compartida)
docker compose exec db mysqldump \
  -u root -p"${MYSQL_ROOT_PASSWORD}" --all-databases \
  > "backup_alumnos_$(date +%Y%m%d_%H%M).sql"

# Backup de la BD del panel
docker compose exec panel_db pg_dump \
  -U panel panel \
  > "backup_panel_$(date +%Y%m%d_%H%M).sql"
```

Automatizar con cron:
```bash
crontab -e
# Backup diario a las 22:00:
0 22 * * * cd /opt/dolibarr-edu/dolibarr-edu && ./scripts/backup.sh
```

---

## Reinstalación limpia

> ⚠ **Esta operación elimina todos los datos** (BD, ficheros, configuración). Úsala solo si quieres empezar desde cero.

El script `reset.sh` hace backup de las bases de datos y el `.env`, para todos los contenedores, borra los volúmenes, elimina el directorio y lanza el instalador automáticamente.

```bash
bash /opt/dolibarr-edu/dolibarr-edu/reset.sh
```

El script pedirá confirmación escribiendo **RESETEAR** antes de proceder.

### Opciones

| Opción | Efecto |
|---|---|
| `--skip-backup` | Omite el backup previo (más rápido, sin red de seguridad) |
| `--yes` | No pide confirmación (uso en scripts no interactivos) |

```bash
# Sin backup ni confirmación
bash reset.sh --skip-backup --yes
```

### ¿Qué hace exactamente?

1. **Backup automático** en `~/erp-edu-backup-<fecha>/`:
   - `env_backup.txt` — copia del `.env` con todas las contraseñas
   - `backup_alumnos.sql` — volcado de todas las BD de alumnos
   - `backup_panel.sql` — volcado de la BD del panel
2. `docker compose down -v` — para contenedores y borra volúmenes
3. Elimina imágenes Docker del panel
4. Borra `/opt/dolibarr-edu`
5. Ejecuta `install.sh` — instalación completa desde cero

---

## Resolución de problemas

### El panel da 502

```bash
# Comprobar que panel_web y panel_api están en marcha
docker compose ps

# Ver logs
docker compose logs panel_web --tail=20
docker compose logs panel_api --tail=20
```

Si `panel_api` está en `Restarting`, probablemente falta `ADMIN_PASSWORD_HASH` o `SESSION_SECRET` en el `.env`.

### Un alumno no abre su Dolibarr

```bash
# Estado del contenedor del alumno
docker ps -a --filter "name=dolibarr_alu_<usuario>"

# Logs
docker logs dolibarr_alu_<usuario> --tail=30

# Comprobar enrutado de Traefik
docker compose logs traefik --tail=30
```

Desde el panel, en la ficha del alumno, los botones **Iniciar / Detener / Eliminar** y **Redesplegar** permiten regenerar el contenedor sin tocar la consola.

### El túnel Cloudflare da 502

Verifica que el servicio de destino responde localmente:
```bash
curl -I http://localhost:${PANEL_PORT:-8068}     # panel
curl -I http://localhost:${TRAEFIK_PORT:-8090}   # traefik
```

Si responde localmente pero no desde Cloudflare, revisa que en el dashboard el servicio apunta a la URL correcta (con el nombre Docker interno, no `localhost`).

### Cualquier subdominio de alumno da 524 (timeout)

Casi siempre es **falta el registro DNS wildcard**, o está mal apuntado. El síntoma característico:

- `https://panel.micentro.es/` funciona ✅
- `https://<alumno>.micentro.es/` da 524 ❌
- `docker compose logs cloudflared` **no muestra nada** cuando recargas la página del alumno → la petición ni siquiera llega al túnel.

**Diagnóstico:**

```bash
# 1) Traefik responde al contenedor del alumno por dentro (descarta Traefik/Docker)
sudo docker run --rm --network dolibarr_net alpine \
  wget -qO- --timeout=5 -S --header="Host: <alumno>.micentro.es" \
  http://traefik:80/ 2>&1 | head -3
# Debe devolver 200 OK

# 2) Mira los logs en directo mientras recargas la URL en el navegador
docker compose logs --since 30s -f cloudflared | grep -iE "GET|<alumno>"
# Si no aparece nada, la petición NO está llegando al túnel
```

**Fix:** en Cloudflare Dashboard → tu dominio → **DNS → Records**, comprueba el registro con `Name = *`:

- Debe ser `CNAME` con destino **`<UUID>.cfargotunnel.com`** (mismo UUID que ves en `docker compose logs cloudflared`, línea `tunnelID=...`).
- Debe estar **Proxied** (nube naranja).
- Si está como `CNAME * → micentro.es` (apuntando al propio dominio), edítalo y cambia el destino al `cfargotunnel.com`.

Tras editar el DNS, espera ~15 segundos y prueba de nuevo.

### Error de certificado SSL en subdominios de alumno

Si el navegador advierte que el certificado es para `*.otro-dominio` o "no válido para este host", significa que estás usando un nivel de subdominio que SSL Universal no cubre.

SSL Universal (gratis) cubre `micentro.es` y `*.micentro.es` (un nivel). **No cubre** `*.erp.micentro.es` (dos niveles). Soluciones:

- **Recomendado:** usar dominio base de un nivel (`BASE_DOMAIN=micentro.es` en el `.env`, alumnos en `<alumno>.micentro.es`).
- **Alternativa:** contratar **Advanced Certificate Manager** en Cloudflare y pedir un certificado para `*.erp.micentro.es`.

Tras cambiar `BASE_DOMAIN` en el `.env`:
```bash
docker compose restart panel_api
```
Y desde el panel, en **Configuración**, actualiza el campo **Dominio base** al mismo valor para que las URLs y reglas de Traefik se regeneren.

### Olvidé la contraseña de admin de un Dolibarr de alumno

Desde el panel, en la ficha del alumno, el botón **Restablecer contraseña** regenera la credencial determinista del alumno y la muestra en pantalla.
