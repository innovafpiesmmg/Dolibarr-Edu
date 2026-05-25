#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  reset.sh — ERP EDU
#  Reinstalación limpia: elimina todos los datos y vuelve a
#  instalar ERP EDU desde cero.
#  Repositorio: https://github.com/innovafpiesmmg/Dolibarr-Edu
#
#  Uso:
#    bash /opt/dolibarr-edu/dolibarr-edu/reset.sh
#
#  Opciones:
#    --skip-backup   No hacer backup previo
#    --yes           No pedir confirmación (uso no interactivo)
# ─────────────────────────────────────────────────────────

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/dolibarr-edu}"
WORK_DIR="$REPO_DIR/dolibarr-edu"
BACKUP_DIR="${BACKUP_DIR:-$HOME/erp-edu-backup-$(date +%Y%m%d_%H%M%S)}"
INSTALL_URL="https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/install.sh"

SKIP_BACKUP=false
AUTO_YES=false

for arg in "$@"; do
  case $arg in
    --skip-backup) SKIP_BACKUP=true ;;
    --yes)         AUTO_YES=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
_sudo()   { [[ $EUID -eq 0 ]] && "$@" || sudo "$@"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            ERP EDU — Reinstalación limpia                   ║"
echo "║                                                              ║"
echo "║  ⚠  ESTA OPERACIÓN ELIMINA TODOS LOS DATOS  ⚠               ║"
echo "║     Dolibarr · OpenProject · Nextcloud · Panel              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Confirmación ──────────────────────────────────────────────────────────────
if [[ "$AUTO_YES" == false ]]; then
  warn "Se eliminarán TODOS los contenedores, volúmenes y ficheros de ERP EDU."
  warn "Esta acción es IRREVERSIBLE si no realizas un backup previo."
  echo ""
  read -rp "Escribe RESETEAR para confirmar: " CONFIRM
  [[ "$CONFIRM" == "RESETEAR" ]] || { echo "Operación cancelada."; exit 0; }
  echo ""
fi

# ── Backup previo ─────────────────────────────────────────────────────────────
if [[ "$SKIP_BACKUP" == false ]] && [[ -d "$WORK_DIR" ]]; then
  info "Creando backup en $BACKUP_DIR ..."
  mkdir -p "$BACKUP_DIR"

  # Guardar .env
  if [[ -f "$WORK_DIR/.env" ]]; then
    cp "$WORK_DIR/.env" "$BACKUP_DIR/env_backup.txt"
    success ".env guardado en $BACKUP_DIR/env_backup.txt"
  fi

  # Cargar variables del .env para los backups de BD
  if [[ -f "$WORK_DIR/.env" ]]; then
    set -a; source "$WORK_DIR/.env" 2>/dev/null || true; set +a
  fi

  cd "$WORK_DIR"

  # BD Dolibarr
  if docker compose ps db 2>/dev/null | grep -q "running\|Up"; then
    info "Haciendo backup de la BD de Dolibarr..."
    docker compose exec -T db \
      mysqldump -u root -p"${MYSQL_ROOT_PASSWORD:-root}" dolibarr \
      > "$BACKUP_DIR/backup_dolibarr.sql" 2>/dev/null \
      && success "BD Dolibarr → $BACKUP_DIR/backup_dolibarr.sql" \
      || warn "No se pudo hacer backup de Dolibarr (puede que no esté inicializada)"
  fi

  # BD panel
  if docker compose ps panel_db 2>/dev/null | grep -q "running\|Up"; then
    info "Haciendo backup de la BD del panel..."
    docker compose exec -T panel_db \
      pg_dump -U panel panel \
      > "$BACKUP_DIR/backup_panel.sql" 2>/dev/null \
      && success "BD panel → $BACKUP_DIR/backup_panel.sql" \
      || warn "No se pudo hacer backup del panel (puede que no esté inicializada)"
  fi

  echo ""
  success "Backup completado en: $BACKUP_DIR"
  echo ""
fi

# ── Parar y eliminar contenedores + volúmenes ─────────────────────────────────
if [[ -d "$WORK_DIR" ]]; then
  cd "$WORK_DIR"
  if [[ -f "docker-compose.yml" ]]; then
    info "Parando contenedores y eliminando volúmenes..."
    docker compose down -v --remove-orphans 2>/dev/null || true
    success "Contenedores y volúmenes eliminados."
  fi
else
  warn "No se encontró $WORK_DIR, omitiendo parada de contenedores."
fi

# ── Eliminar imágenes del panel ───────────────────────────────────────────────
info "Eliminando imágenes Docker del panel..."
docker rmi dolibarr-edu-panel_api dolibarr-edu-panel_web 2>/dev/null || true
success "Imágenes eliminadas (si existían)."

# ── Eliminar directorio ───────────────────────────────────────────────────────
info "Eliminando $REPO_DIR ..."
_sudo rm -rf "$REPO_DIR"
success "Directorio eliminado."

# ── Reinstalar ────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────────────────────"
info "Iniciando instalación limpia..."
echo "────────────────────────────────────────────────────────────────"
echo ""

curl -fsSL "$INSTALL_URL" | bash

echo ""
echo "────────────────────────────────────────────────────────────────"
success "Reinstalación completada."
if [[ "$SKIP_BACKUP" == false ]] && [[ -d "$BACKUP_DIR" ]]; then
  info "Tus backups anteriores están en: $BACKUP_DIR"
fi
echo "────────────────────────────────────────────────────────────────"
