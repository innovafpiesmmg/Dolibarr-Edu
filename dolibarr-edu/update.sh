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

# ── Backup previo ─────────────────────────────────────────────────────────────
cd "$WORK_DIR"

info "Realizando backup de la base de datos de Dolibarr..."
BACKUP_FILE_DOLI="$BACKUP_DIR/dolibarr_${TIMESTAMP}.sql"
if docker compose exec -T db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
     < /dev/null > "$BACKUP_FILE_DOLI" 2>/dev/null; then
  success "Backup Dolibarr → $BACKUP_FILE_DOLI"
else
  warn "No se pudo hacer backup de Dolibarr (puede que no esté en marcha)."
fi

info "Realizando backup de la base de datos de OpenProject..."
BACKUP_FILE_OP="$BACKUP_DIR/openproject_${TIMESTAMP}.sql"
if docker compose exec -T openproject_db sh -c \
     'pg_dump -U openproject openproject' < /dev/null > "$BACKUP_FILE_OP" 2>/dev/null; then
  success "Backup OpenProject → $BACKUP_FILE_OP"
else
  warn "No se pudo hacer backup de OpenProject (puede que no esté activo)."
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
  # Ejecutar igualmente la migración del .env por si faltan claves nuevas
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

# Claves Nextcloud (introducidas en versiones recientes)
_ensure_key "NC_HOST"             ""
_ensure_key "NC_PORT"             "8071"
_ensure_key "NC_DB_ROOT_PASSWORD" "$(gen_pass 24)"
_ensure_key "NC_DB_PASSWORD"      "$(gen_pass 24)"
_ensure_key "NC_ADMIN_USER"       "admin"
_ensure_key "NC_ADMIN_PASSWORD"   "$(gen_pass 20)"
_ensure_key "NEXTCLOUD_URL"       "http://nextcloud:80"
_ensure_key "COMPOSE_PROFILES"    ""

# Clave OFFICE_HOST (introducida en versiones recientes)
_ensure_key "OFFICE_HOST"         "office.micentro.es"

# Si NC_HOST tiene valor pero el perfil no está activado → activarlo automáticamente
NC_HOST_VAL=$(_get NC_HOST)
PROFILES_VAL=$(_get COMPOSE_PROFILES)
if [[ -n "$NC_HOST_VAL" && "$PROFILES_VAL" != *"nextcloud"* ]]; then
  _set "COMPOSE_PROFILES" "nextcloud"
  info "Perfil Nextcloud activado automáticamente (NC_HOST=$NC_HOST_VAL)"
fi

success "Migración del .env completada"

# ── Actualizar imágenes y reiniciar ──────────────────────────────────────────
cd "$WORK_DIR"

info "Descargando nuevas imágenes Docker (puede tardar varios minutos)..."
docker compose pull --ignore-buildable

info "Reconstruyendo imágenes del panel..."
docker compose build panel_migrator panel_api panel_web

info "Reiniciando servicios..."
docker compose up -d --remove-orphans

# ── Esperar a que Dolibarr esté listo ────────────────────────────────────────
info "Esperando a que Dolibarr esté listo..."
for i in {1..30}; do
  if docker compose exec -T dolibarr sh -c 'test -f /var/www/html/index.php' < /dev/null 2>/dev/null; then
    success "Dolibarr listo"
    break
  fi
  sleep 3
done

# ── Activar el módulo REST API de Dolibarr (idempotente) ─────────────────────
# DOLI_MODULES solo se aplica al primer arranque, así que en instalaciones
# ya existentes hay que activar el módulo via SQL.
info "Activando módulo REST API de Dolibarr..."
if docker compose exec -T db sh -c \
     'exec mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "INSERT INTO llx_const (name, value, type, visible, note, entity) VALUES (\"MAIN_MODULE_API\", \"1\", \"chaine\", 0, \"\", 0) ON DUPLICATE KEY UPDATE value=\"1\";"' \
     < /dev/null > /dev/null 2>&1; then
  success "Módulo REST API activo"
else
  warn "No se pudo activar el módulo REST API automáticamente (actívalo manualmente desde Dolibarr → Inicio → Configuración → Módulos)"
fi

# ── Esperar a que OpenProject esté listo ─────────────────────────────────────
info "Esperando a que OpenProject esté listo..."
for i in {1..60}; do
  if docker compose exec -T openproject sh -c 'curl -sf http://localhost/health > /dev/null 2>&1' < /dev/null 2>/dev/null; then
    success "OpenProject listo"
    break
  fi
  sleep 5
done

# ── Limpieza de backups antiguos (guarda los últimos 5) ──────────────────────
ls -t "$BACKUP_DIR"/dolibarr_*.sql    2>/dev/null | tail -n +6 | xargs -r rm --
ls -t "$BACKUP_DIR"/openproject_*.sql 2>/dev/null | tail -n +6 | xargs -r rm --

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
