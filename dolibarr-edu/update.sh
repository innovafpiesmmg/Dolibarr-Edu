#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  update.sh — ERP EDU
#  Actualiza ERP EDU desde GitHub sin perder datos.
#  Migra el .env automáticamente si hay claves nuevas.
#  Repositorio: https://github.com/innovafpiesmmg/Dolibarr-Edu
#
#  Uso:
#    bash /opt/dolibarr-edu/dolibarr-edu/update.sh
#  o bien desde cualquier lugar:
#    curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/update.sh | bash
# ─────────────────────────────────────────────────────────

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/dolibarr-edu}"
WORK_DIR="$REPO_DIR/dolibarr-edu"
BACKUP_DIR="$WORK_DIR/backups"
BRANCH="${BRANCH:-main}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
gen_pass(){ openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c "${1:-24}"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ERP EDU — Actualización                     ║"
echo "║  https://github.com/innovafpiesmmg/Dolibarr-Edu              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

[[ -d "$WORK_DIR" ]] || error "No se encontró la instalación en $WORK_DIR. Ejecuta install.sh primero."

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M)

# ── Backup previo (MariaDB con todas las BDs de alumnos) ──────────────────────
cd "$WORK_DIR"

info "Realizando backup completo de MariaDB (incluye BDs de todos los alumnos)..."
BACKUP_FILE_DOLI="$BACKUP_DIR/mariadb_${TIMESTAMP}.sql"
if docker compose exec -T db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --all-databases' \
     < /dev/null > "$BACKUP_FILE_DOLI" 2>/dev/null; then
  success "Backup MariaDB → $BACKUP_FILE_DOLI"
else
  warn "No se pudo hacer backup de MariaDB (puede que no esté en marcha)."
fi

# ── Guardar .env ──────────────────────────────────────────────────────────────
cp "$WORK_DIR/.env" /tmp/dolibarr_edu_env.bak
info "Configuración (.env) guardada"

# ── Descargar nueva versión ───────────────────────────────────────────────────
cd "$REPO_DIR"
info "Comprobando actualizaciones desde GitHub ($BRANCH)..."
git fetch origin "$BRANCH"

CURRENT=$(git rev-parse HEAD)
LATEST=$(git rev-parse "origin/$BRANCH")

if [[ "$CURRENT" == "$LATEST" ]]; then
  success "Ya estás en la última versión. No hay actualizaciones."
else
  COMMITS=$(git log --oneline "$CURRENT..$LATEST" | wc -l)
  info "Se aplicarán $COMMITS commit(s) nuevos:"
  git log --oneline "$CURRENT..$LATEST"
  echo ""
  git pull origin "$BRANCH"
  success "Código actualizado"
fi

# ── Restaurar .env (el git pull no lo toca, pero lo restauramos por seguridad) ──
cp /tmp/dolibarr_edu_env.bak "$WORK_DIR/.env"
success ".env restaurado (tu configuración se mantiene intacta)"

# ── Migración automática del .env ─────────────────────────────────────────────
# Añade claves nuevas que falten en instalaciones anteriores.
# NUNCA sobreescribe claves que ya existen.

ENV_FILE="$WORK_DIR/.env"

_get()        { grep "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true; }
_has()        { grep -q "^${1}=" "$ENV_FILE" 2>/dev/null; }
_set()        { sed -i "s|^${1}=.*|${1}=${2}|" "$ENV_FILE"; }
_ensure_key() {
  local key="$1" default="$2"
  if ! _has "$key"; then
    echo "${key}=${default}" >> "$ENV_FILE"
    info "Nueva clave añadida: ${key}"
  fi
}

# Orquestación de Dolibarr por alumno
_ensure_key "BASE_DOMAIN"            "erp.micentro.es"
_ensure_key "DOLIBARR_IMAGE"         "dolibarr/dolibarr:latest"
_ensure_key "STUDENT_DOCKER_NETWORK" "dolibarr_net"
# Forzar valor correcto si .env tenía el nombre antiguo (con prefijo compose)
if grep -q '^STUDENT_DOCKER_NETWORK=dolibarr-edu_dolibarr_net' "$ENV_FILE"; then
  _set "STUDENT_DOCKER_NETWORK" "dolibarr_net"
  info "STUDENT_DOCKER_NETWORK actualizado a dolibarr_net (nombre fijo)"
fi
_ensure_key "TRAEFIK_PORT"           "8090"
_ensure_key "PANEL_PORT"             "8068"
_ensure_key "COMPOSE_PROFILES"       ""

# ── Recomponer COMPOSE_PROFILES ─────────────────────────────────────────────
# Solo "cloudflare" es opcional: activo si hay token (evita restart loop de cloudflared).
CF_TOKEN_VAL=$(_get CLOUDFLARE_TOKEN)
if [[ -n "$CF_TOKEN_VAL" ]]; then
  _set "COMPOSE_PROFILES" "cloudflare"
  info "Perfiles Compose activos: cloudflare"
else
  _set "COMPOSE_PROFILES" ""
  info "Sin perfiles opcionales activos"
fi

success "Migración del .env completada"

# ── Actualizar imágenes y reiniciar ──────────────────────────────────────────
cd "$WORK_DIR"

info "Descargando nuevas imágenes Docker (puede tardar varios minutos)..."
docker compose pull --ignore-buildable

info "Reconstruyendo imágenes del panel sin caché (garantiza código actualizado)..."
# --no-cache es crítico: sin él, Docker reutiliza capas antiguas aunque el código fuente
# haya cambiado en GitHub, dejando el panel con una versión vieja del backend.
docker compose build --no-cache panel_migrator panel_api panel_web

info "Reiniciando servicios..."
docker compose up -d --remove-orphans

# ── Limpieza de backups antiguos (guarda los últimos 5) ──────────────────────
ls -t "$BACKUP_DIR"/mariadb_*.sql 2>/dev/null | tail -n +6 | xargs -r rm --

echo ""
echo "════════════════════════════════════════════════════════════════"
success "¡Actualización completada!"
if [[ "$CURRENT" != "$LATEST" ]]; then
  echo ""
  echo "  Versión anterior : $(echo "$CURRENT" | head -c 8)"
  echo "  Versión actual   : $(echo "$LATEST"  | head -c 8)"
fi
echo "════════════════════════════════════════════════════════════════"
echo ""
