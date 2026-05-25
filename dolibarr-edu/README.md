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
   ├── panel.micentro.es    → panel_web:80      (nginx + React)
   ├── erp.micentro.es      → dolibarr:80       (PHP/Apache)
   ├── proyectos.micentro.es→ openproject:80    (Rails)
   └── office.micentro.es   → collabora:9980    (CODE)

Servidor Ubuntu/Debian — red Docker interna (dolibarr_net)
   ├── cloudflared       ← cliente del túnel Cloudflare
   ├── panel_web         ← nginx sirviendo React + proxy /api→panel_api
   ├── panel_api         ← Node.js/Express API REST (puerto host 8080 interno)
   ├── panel_db          ← PostgreSQL exclusiva del panel
   ├── dolibarr          ← Dolibarr ERP (puerto host 8069)
   ├── db                ← MariaDB de Dolibarr
   ├── openproject       ← OpenProject (puerto host 8070)
   ├── openproject_db    ← PostgreSQL de OpenProject
   └── collabora         ← Collabora Online (puerto host 9980)
```

---

## Requisitos del servidor

| Componente | Mínimo recomendado |
|---|---|
| SO | Ubuntu 22.04 LTS o Debian 12 |
| CPU | 2 cores |
| RAM | **4 GB** (OpenProject requiere al menos 2 GB para él solo) |
| Disco | 40 GB |
| Software | Docker 24+ y Docker Compose 2+ |
| Red | Conexión a internet; NO es necesario abrir puertos |

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
- Pide la contraseña del panel, los dominios y el token de Cloudflare
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
| `erp` | `micentro.es` | `http://dolibarr:80` | Dolibarr ERP |
| `proyectos` | `micentro.es` | `http://openproject:80` | OpenProject |
| `office` | `micentro.es` | `http://collabora:9980` | Collabora Online |

> Los nombres de servicio (`panel_web`, `dolibarr`, `openproject`, `collabora`) son los hostnames internos de Docker. El contenedor `cloudflared` resuelve estos nombres automáticamente porque todos están en la red `dolibarr_net`.

Cloudflare crea los registros DNS automáticamente al guardar cada entrada.

### Verificar la conexión

```bash
# Logs del túnel
docker compose logs cloudflared --tail=20

# Test local de cada servicio
curl -sI http://localhost:8068 | head -1   # panel_web
curl -sI http://localhost:8069 | head -1   # dolibarr
curl -sI http://localhost:8070 | head -1   # openproject
curl -sI http://localhost:9980 | head -1   # collabora
```

---

## Variables de entorno

Fichero: `/opt/dolibarr-edu/dolibarr-edu/.env`

```bash
# ── MariaDB (Dolibarr) ──────────────────────────────────
MYSQL_ROOT_PASSWORD=...
MYSQL_DATABASE=dolibarr
MYSQL_USER=dolibarr
MYSQL_PASSWORD=...

# ── Dolibarr ERP ────────────────────────────────────────
DOLI_URL_ROOT=https://erp.micentro.es
DOLI_DOMAIN=erp.micentro.es
DOLI_ADMIN_LOGIN=admin
DOLI_ADMIN_PASSWORD=...
DOLI_ADMIN_EMAIL=admin@micentro.es
DOLI_COMPANY_NAME=Centro FP Administración de Empresas
APP_PORT=8069

# ── OpenProject ─────────────────────────────────────────
OP_HOST=proyectos.micentro.es
OP_DB_PASSWORD=...
OP_SECRET_KEY=...
OP_PORT=8070

# ── Collabora Online ────────────────────────────────────
COLLABORA_ADMIN=admin
COLLABORA_PASSWORD=...
COLLABORA_PORT=9980

# ── Panel EDU (Node.js) ─────────────────────────────────
PANEL_URL=https://panel.micentro.es
PANEL_DB_PASSWORD=...
DOLIBARR_BASE_URL=https://erp.micentro.es
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
docker compose logs -f dolibarr
docker compose logs -f openproject

# Reiniciar un servicio
docker compose restart panel_web

# Reconstruir imágenes del panel (tras actualización)
docker compose build panel_api panel_web
docker compose up -d panel_api panel_web

# Parar todo
docker compose down

# Parar todo y eliminar volúmenes (¡BORRA DATOS!)
docker compose down -v
```

---

## Copias de seguridad

```bash
# Backup de la BD de Dolibarr
docker compose exec db mysqldump \
  -u root -p"${MYSQL_ROOT_PASSWORD}" dolibarr \
  > "backup_dolibarr_$(date +%Y%m%d_%H%M).sql"

# Backup de documentos adjuntos de Dolibarr
docker run --rm \
  -v dolibarr-edu_dolibarr_docs:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/docs_$(date +%Y%m%d).tar.gz /data

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

### Dolibarr da "Internal Server Error"

La causa más común es que `DOLI_URL_ROOT` no coincide con el dominio real. Corrígelo y recrea el contenedor:

```bash
sed -i "s|^DOLI_URL_ROOT=.*|DOLI_URL_ROOT=https://TU_DOMINIO_REAL|" .env
sed -i "s|^DOLI_DOMAIN=.*|DOLI_DOMAIN=TU_DOMINIO_REAL|" .env
docker compose up -d --force-recreate dolibarr
```

### El túnel Cloudflare da 502

Verifica que el servicio de destino responde localmente:
```bash
curl -I http://localhost:8068   # panel
curl -I http://localhost:8069   # dolibarr
```

Si responde localmente pero no desde Cloudflare, revisa que en el dashboard el servicio apunta a la URL correcta (con el nombre Docker interno, no `localhost`).

### OpenProject en bucle de reinicios

Suele ser falta de RAM. OpenProject necesita al menos 2 GB disponibles:
```bash
free -h
docker compose logs openproject --tail=30
```

### Olvidé la contraseña de admin de Dolibarr

```bash
docker compose exec db mysql \
  -u root -p"${MYSQL_ROOT_PASSWORD}" dolibarr \
  -e "UPDATE llx_user SET pass_crypted=MD5('nueva_contrasena') WHERE login='admin';"
```
