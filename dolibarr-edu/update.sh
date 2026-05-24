#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  update.sh — Dolibarr EDU
#  Actualiza Dolibarr EDU desde GitHub sin perder los datos
#
#  Uso:
#    cd /opt/dolibarr-edu && ./update.sh
#  o bien:
#    curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/update.sh | bash
# ─────────────────────────────────────────────────────────

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/dolibarr-edu}"
BACKUP_DIR="${INSTALL_DIR}/backups"
BRANCH="${BRANCH:-main}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Dolibarr EDU — Actualización                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

[[ -d "$INSTALL_DIR" ]] || error "No se encontró la instalación en $INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Backup previo ─────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M)
BACKUP_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.sql"

info "Realizando backup de la base de datos..."
if docker compose exec -T db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
     > "$BACKUP_FILE" 2>/dev/null; then
  success "Backup guardado: $BACKUP_FILE"
else
  warn "No se pudo hacer backup automático. Continúa con precaución."
fi

# ── Guardar .env antes de actualizar ─────────────────────
cp .env /tmp/dolibarr_edu_env.bak
info "Variables de entorno guardadas temporalmente"

# ── Descargar nueva versión ───────────────────────────────
info "Descargando actualizaciones desde GitHub..."
git fetch origin "$BRANCH"

CURRENT=$(git rev-parse HEAD)
LATEST=$(git rev-parse "origin/$BRANCH")

if [[ "$CURRENT" == "$LATEST" ]]; then
  success "Ya estás en la última versión. No hay actualizaciones."
  exit 0
fi

COMMITS=$(git log --oneline "$CURRENT..$LATEST" | wc -l)
info "Se aplicarán $COMMITS commit(s) nuevos:"
git log --oneline "$CURRENT..$LATEST"

git pull origin "$BRANCH"
success "Código actualizado"

# ── Restaurar .env ────────────────────────────────────────
cp /tmp/dolibarr_edu_env.bak .env
success ".env restaurado"

# ── Actualizar contenedores ───────────────────────────────
info "Descargando nuevas imágenes Docker..."
docker compose pull

info "Reiniciando servicios..."
docker compose up -d --remove-orphans

# Esperar a que Dolibarr esté listo
info "Esperando a que Dolibarr esté listo..."
for i in {1..30}; do
  if docker compose exec -T dolibarr sh -c 'test -f /var/www/html/index.php' 2>/dev/null; then
    break
  fi
  sleep 3
done

success "Servicios actualizados y en marcha"

# ── Limpieza de backups antiguos (guarda los últimos 5) ──
info "Limpiando backups antiguos..."
ls -t "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | tail -n +6 | xargs -r rm --
success "Backups anteriores al 5 más reciente eliminados"

echo ""
echo "════════════════════════════════════════════════════════"
success "¡Actualización completada!"
echo ""
echo "  Versión anterior: $(echo "$CURRENT" | head -c 8)"
echo "  Versión actual:   $(echo "$LATEST" | head -c 8)"
echo ""
echo "  Backup guardado en: $BACKUP_FILE"
echo "════════════════════════════════════════════════════════"
