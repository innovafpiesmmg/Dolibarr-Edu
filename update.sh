#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  update.sh — ERP EDU
#  Actualiza ERP EDU desde GitHub sin perder datos
#  Repositorio: https://github.com/innovafpiesmmg/Dolibarr-Edu
#
#  Uso:
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

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ERP EDU — Actualización                     ║"
echo "║  https://github.com/innovafpiesmmg/Dolibarr-Edu              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

[[ -d "$WORK_DIR" ]] || error "No se encontró la instalación en $WORK_DIR. Ejecuta install.sh primero."
cd "$REPO_DIR"

# ── Backup previo ─────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M)

info "Realizando backup de la base de datos de Dolibarr..."
BACKUP_FILE_DOLI="$BACKUP_DIR/dolibarr_${TIMESTAMP}.sql"
if (cd "$WORK_DIR" && docker compose exec -T db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"') \
     > "$BACKUP_FILE_DOLI" 2>/dev/null; then
  success "Backup Dolibarr → $BACKUP_FILE_DOLI"
else
  warn "No se pudo hacer backup automático de Dolibarr. Continúa con precaución."
fi

info "Realizando backup de la base de datos de OpenProject..."
BACKUP_FILE_OP="$BACKUP_DIR/openproject_${TIMESTAMP}.sql"
if (cd "$WORK_DIR" && docker compose exec -T openproject_db sh -c \
     'pg_dump -U openproject openproject') > "$BACKUP_FILE_OP" 2>/dev/null; then
  success "Backup OpenProject → $BACKUP_FILE_OP"
else
  warn "No se pudo hacer backup de OpenProject (puede que el servicio no esté activo)."
fi

# ── Guardar .env ──────────────────────────────────────────────────────────────
cp "$WORK_DIR/.env" /tmp/dolibarr_edu_env.bak
info "Configuración (.env) guardada temporalmente"

# ── Descargar nueva versión ───────────────────────────────────────────────────
info "Comprobando actualizaciones desde GitHub ($BRANCH)..."
git fetch origin "$BRANCH"

CURRENT=$(git rev-parse HEAD)
LATEST=$(git rev-parse "origin/$BRANCH")

if [[ "$CURRENT" == "$LATEST" ]]; then
  success "Ya estás en la última versión ($BRANCH). No hay actualizaciones."
  cp /tmp/dolibarr_edu_env.bak "$WORK_DIR/.env"
  exit 0
fi

COMMITS=$(git log --oneline "$CURRENT..$LATEST" | wc -l)
info "Se aplicarán $COMMITS commit(s) nuevos:"
git log --oneline "$CURRENT..$LATEST"
echo ""

git pull origin "$BRANCH"
success "Código actualizado"

# ── Restaurar .env ────────────────────────────────────────────────────────────
cp /tmp/dolibarr_edu_env.bak "$WORK_DIR/.env"
success ".env restaurado (tu configuración se mantiene intacta)"

# ── Actualizar imágenes y reiniciar ──────────────────────────────────────────
cd "$WORK_DIR"
info "Descargando nuevas imágenes Docker (puede tardar varios minutos)..."
docker compose pull

info "Reiniciando servicios..."
docker compose up -d --remove-orphans

# ── Esperar a que los servicios estén listos ──────────────────────────────────
info "Esperando a que Dolibarr esté listo..."
for i in {1..30}; do
  if docker compose exec -T dolibarr sh -c 'test -f /var/www/html/index.php' 2>/dev/null; then
    success "Dolibarr listo"
    break
  fi
  sleep 3
done

info "Esperando a que OpenProject esté listo (puede tardar ~2-3 min)..."
for i in {1..60}; do
  if docker compose exec -T openproject sh -c 'curl -sf http://localhost/health > /dev/null 2>&1'; then
    success "OpenProject listo"
    break
  fi
  sleep 5
done

# ── Limpieza de backups antiguos ──────────────────────────────────────────────
info "Limpiando backups antiguos (se conservan los 5 más recientes)..."
ls -t "$BACKUP_DIR"/dolibarr_*.sql    2>/dev/null | tail -n +6 | xargs -r rm --
ls -t "$BACKUP_DIR"/openproject_*.sql 2>/dev/null | tail -n +6 | xargs -r rm --
success "Backups anteriores al 5 más reciente eliminados"

echo ""
echo "════════════════════════════════════════════════════════════════"
success "¡Actualización completada!"
echo ""
echo "  Versión anterior : $(echo "$CURRENT" | head -c 8)"
echo "  Versión actual   : $(echo "$LATEST"  | head -c 8)"
echo ""
echo "  Backup Dolibarr  : $BACKUP_FILE_DOLI"
echo "  Backup OpenProject: $BACKUP_FILE_OP"
echo "════════════════════════════════════════════════════════════════"
echo ""
