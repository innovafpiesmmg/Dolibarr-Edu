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

### Paso 1 — Crear el túnel en el dashboard

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Zero Trust → Networks → Tunnels → Create a tunnel**
3. Elige **Cloudflared** · ponle un nombre (ej: `dolibarr-edu`)
4. Copia el **token** que aparece en el comando de instalación:
   ```
   cloudflared service install eyJhIjoiMT...
   ```
   El token es la cadena larga que empieza por `eyJ`.

### Paso 2 — Guardar el token en el servidor

```bash
cd /opt/dolibarr-edu/dolibarr-edu

# Añadir al .env
echo "CLOUDFLARE_TOKEN=eyJhIjoiMT..." >> .env

# Arrancar el túnel
docker compose up -d cloudflared
sleep 5
docker compose logs cloudflared --tail=15
```

Cuando veas `Registered tunnel connection`, el túnel está activo y conectado.

### Paso 3 — Configurar los conectores (Public Hostnames)

En el dashboard de Cloudflare → tu túnel → **Edit** → **Public Hostname** → **Add a public hostname**:

| Subdominio | Dominio | Servicio (URL interna) | Notas |
|---|---|---|---|
| `panel` | `micentro.es` | `http://panel_web:80` | Panel de gestión |
| `*` | `erp.micentro.es` | `http://traefik:80` | **Comodín** — un subdominio por alumno (`<usuario>.erp.micentro.es`) |

> Para que el comodín funcione, el dominio `erp.micentro.es` debe estar gestionado por Cloudflare. El registro DNS comodín (`*.erp`) se crea automáticamente al guardar el Public Hostname.

### Verificar la conexión

```bash
# Logs del túnel
docker compose logs cloudflared --tail=20

# Test local
curl -sI http://localhost:${PANEL_PORT:-8068} | head -1     # panel_web
curl -sI http://localhost:${TRAEFIK_PORT:-8090} | head -1   # traefik (router de alumnos)
```

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

### Olvidé la contraseña de admin de un Dolibarr de alumno

Desde el panel, en la ficha del alumno, el botón **Restablecer contraseña** regenera la credencial determinista del alumno y la muestra en pantalla.
