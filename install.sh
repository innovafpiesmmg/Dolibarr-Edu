#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  install.sh — ERP EDU
#  Instala ERP EDU (Dolibarr + OpenProject + Collabora + Panel)
#  Repositorio: https://github.com/innovafpiesmmg/Dolibarr-Edu
#
#  Uso de un solo comando:
#    curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/install.sh | bash
#
#  Requisitos:
#    - Ubuntu 22.04 / Debian 12 (o compatible)
#    - Conexión a internet
# ─────────────────────────────────────────────────────────

set -euo pipefail

REPO="https://github.com/innovafpiesmmg/Dolibarr-Edu"
REPO_DIR="${REPO_DIR:-/opt/dolibarr-edu}"
BRANCH="${BRANCH:-main}"
WORK_DIR="$REPO_DIR/dolibarr-edu"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
_sudo()   { [[ $EUID -eq 0 ]] && "$@" || sudo "$@"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ERP EDU — Instalación                      ║"
echo "║  ERP + OpenProject + Collabora Online para FP               ║"
echo "║  https://github.com/innovafpiesmmg/Dolibarr-Edu             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

[[ $EUID -eq 0 ]] && warn "Ejecutando como root."

# ── Dependencias del sistema ──────────────────────────────────────────────────
info "Actualizando lista de paquetes..."
_sudo apt-get update -qq

for PKG in curl git openssl; do
  command -v "$PKG" &>/dev/null \
    && success "$PKG disponible" \
    || { info "Instalando $PKG..."; _sudo apt-get install -y "$PKG"; success "$PKG instalado"; }
done

# ── Docker ────────────────────────────────────────────────────────────────────
DOCKER_JUST_INSTALLED=false
if ! command -v docker &>/dev/null; then
  info "Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | _sudo sh
  [[ $EUID -ne 0 ]] && _sudo usermod -aG docker "$USER"
  success "Docker instalado."
  warn "Si no eres root, cierra sesión y vuelve a entrar (o ejecuta: newgrp docker)"
  DOCKER_JUST_INSTALLED=true
else
  success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') disponible"
fi

# ── Clonar repositorio (solo si no existe) ────────────────────────────────────
if [[ -d "$WORK_DIR" ]]; then
  warn "El repositorio ya existe en $REPO_DIR — se omite el clonado."
else
  info "Clonando repositorio..."
  _sudo git clone --depth 1 --branch "$BRANCH" "$REPO" "$REPO_DIR"
  _sudo chown -R "$USER:$USER" "$REPO_DIR" 2>/dev/null || true
  success "Repositorio en $REPO_DIR"
fi

# ── Crear .env si no existe y generar contraseñas ────────────────────────────
gen_pass() { openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c "${1:-24}"; }

if [[ ! -f "$WORK_DIR/.env" ]]; then
  cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"
  info "Generando contraseñas aleatorias..."

  sed -i "s|cambia_esta_contrasena_root|$(gen_pass 24)|g"     "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_db|$(gen_pass 24)|g"       "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_openproject|$(gen_pass 24)|g" "$WORK_DIR/.env"
  sed -i "s|cambia_esta_clave_secreta_openproject|$(openssl rand -hex 64)|g" "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_collabora|$(gen_pass 20)|g" "$WORK_DIR/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(gen_pass 48)|" "$WORK_DIR/.env"

  # Dolibarr admin — guardar para mostrarlo luego
  DOLI_ADMIN_PASS=$(gen_pass 16)
  sed -i "s|cambia_esta_contrasena_admin|$DOLI_ADMIN_PASS|g"  "$WORK_DIR/.env"
  success ".env creado con contraseñas generadas"
else
  warn ".env ya existe — se mantiene la configuración actual."
  DOLI_ADMIN_PASS="(ya configurada — ver $WORK_DIR/.env)"
fi

# ── Contraseña del panel web ──────────────────────────────────────────────────
CURRENT_HASH=$(grep "^ADMIN_PASSWORD_HASH=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
if [[ -z "$CURRENT_HASH" || "$CURRENT_HASH" == "cambia_este_hash" ]]; then
  echo ""
  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}│         Contraseña del Panel de Gestión                  │${NC}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
  echo ""
  echo "  El panel (profesores, grupos, alumnos) está protegido"
  echo "  con contraseña. Elige una contraseña segura."
  echo ""
  while true; do
    read -rsp "  Contraseña del panel: " PANEL_PASS < /dev/tty; echo ""
    read -rsp "  Confirmar contraseña:  " PANEL_PASS2 < /dev/tty; echo ""
    [[ "$PANEL_PASS" == "$PANEL_PASS2" ]] && break
    echo -e "  ${RED}Las contraseñas no coinciden. Inténtalo de nuevo.${NC}"
  done
  PANEL_HASH=$(echo -n "$PANEL_PASS" | openssl dgst -sha256 | awk '{print $2}')
  if grep -q "^ADMIN_PASSWORD_HASH=" "$WORK_DIR/.env"; then
    sed -i "s|^ADMIN_PASSWORD_HASH=.*|ADMIN_PASSWORD_HASH=$PANEL_HASH|" "$WORK_DIR/.env"
  else
    echo "ADMIN_PASSWORD_HASH=$PANEL_HASH" >> "$WORK_DIR/.env"
  fi
  success "Contraseña del panel configurada"
else
  success "Contraseña del panel ya configurada"
fi

# ── URLs públicas ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│           URLs públicas (dominios del centro)            │${NC}"
echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
echo ""
echo "  Pulsa Enter para aceptar los valores por defecto."
echo ""

read -rp "  URL de Dolibarr ERP     [https://erp.micentro.es]: " DOLI_URL < /dev/tty
DOLI_URL="${DOLI_URL:-https://erp.micentro.es}"
DOLI_DOMAIN=$(echo "$DOLI_URL" | sed 's|https\?://||' | cut -d'/' -f1)

read -rp "  Dominio de OpenProject  [proyectos.micentro.es]: " OP_HOST < /dev/tty
OP_HOST="${OP_HOST:-proyectos.micentro.es}"

read -rp "  Dominio de Collabora    [office.micentro.es]: "    OFFICE_HOST < /dev/tty
OFFICE_HOST="${OFFICE_HOST:-office.micentro.es}"

sed -i "s|^DOLI_URL_ROOT=.*|DOLI_URL_ROOT=$DOLI_URL|"         "$WORK_DIR/.env"
sed -i "s|^DOLI_DOMAIN=.*|DOLI_DOMAIN=$DOLI_DOMAIN|"           "$WORK_DIR/.env"
sed -i "s|^DOLIBARR_BASE_URL=.*|DOLIBARR_BASE_URL=$DOLI_URL|" "$WORK_DIR/.env"
sed -i "s|^OP_HOST=.*|OP_HOST=$OP_HOST|"                       "$WORK_DIR/.env"
success "URLs configuradas"

# ── Cloudflare Tunnel (opcional) ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│           Cloudflare Tunnel (opcional)                   │${NC}"
echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
echo ""
echo "  Si ya tienes un túnel Cloudflare creado, puedes configurarlo"
echo "  ahora. Si no, puedes hacerlo después editando:"
echo "  $WORK_DIR/cloudflare/config.yml"
echo ""
read -rp "  ¿Configurar Cloudflare ahora? [s/N]: " CF_NOW < /dev/tty
CF_NOW="${CF_NOW:-N}"

if [[ "${CF_NOW,,}" == "s" || "${CF_NOW,,}" == "si" || "${CF_NOW,,}" == "y" ]]; then
  read -rp "  UUID del túnel (cloudflared tunnel list): " CF_UUID < /dev/tty
  if [[ -n "$CF_UUID" ]]; then
    sed -i "s|TU_UUID_AQUI|$CF_UUID|g" "$WORK_DIR/cloudflare/config.yml"
    # Actualizar dominios en config.yml
    sed -i "s|erp\.micentro\.es|$DOLI_DOMAIN|g"          "$WORK_DIR/cloudflare/config.yml"
    sed -i "s|proyectos\.micentro\.es|$OP_HOST|g"        "$WORK_DIR/cloudflare/config.yml"
    sed -i "s|office\.micentro\.es|$OFFICE_HOST|g"       "$WORK_DIR/cloudflare/config.yml"
    success "cloudflare/config.yml actualizado con UUID $CF_UUID"
    warn "Copia tu fichero <UUID>.json a $WORK_DIR/cloudflare/ antes de iniciar el túnel."
  else
    warn "UUID vacío — configura Cloudflare después manualmente."
  fi
else
  info "Cloudflare omitido. Configúralo después en $WORK_DIR/cloudflare/config.yml"
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO               ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf  "║  %-30s %-29s║\n" "Dolibarr admin:" "admin / $DOLI_ADMIN_PASS"
printf  "║  %-30s %-29s║\n" "OpenProject admin:" "admin / admin (cámbiala)"
echo "╠══════════════════════════════════════════════════════════════╣"
printf  "║  %-30s %-29s║\n" "Dolibarr ERP:" "$DOLI_URL"
printf  "║  %-30s %-29s║\n" "OpenProject:" "https://$OP_HOST"
printf  "║  %-30s %-29s║\n" "Collabora Online:" "https://$OFFICE_HOST"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── Instrucciones finales ─────────────────────────────────────────────────────
echo ""
success "¡Configuración completada!"
echo ""
echo "Próximos pasos:"
echo ""
echo "  1. Arranca todos los servicios:"
echo "     cd $WORK_DIR && docker compose up -d"
echo ""
echo "  2. Espera ~3 min y comprueba que todo está listo:"
echo "     cd $WORK_DIR && docker compose ps"
echo ""
echo "  3. Configuración inicial del ERP educativo:"
echo "     cd $WORK_DIR && ./scripts/setup-inicial.sh"
echo ""
[[ "$DOCKER_JUST_INSTALLED" == "true" ]] && \
  warn "RECUERDA: ejecuta 'newgrp docker' antes de docker compose (o cierra sesión y vuelve a entrar)."
