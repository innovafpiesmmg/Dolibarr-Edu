#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  install.sh — ERP EDU
#  Instala ERP EDU (Dolibarr + Panel de gestión + Cloudflare)
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
gen_pass(){ openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c "${1:-24}"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ERP EDU — Instalación                      ║"
echo "║  Dolibarr ERP + Panel de gestión para FP                    ║"
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
    || { info "Instalando $PKG..."; _sudo apt-get install -y "$PKG" -qq; success "$PKG instalado"; }
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
  info "Actualizando ficheros del repositorio..."
  git -C "$REPO_DIR" fetch origin "$BRANCH" --quiet 2>/dev/null || true
  git -C "$REPO_DIR" checkout origin/"$BRANCH" -- \
    dolibarr-edu/docker-compose.yml \
    dolibarr-edu/Dockerfile.api \
    dolibarr-edu/Dockerfile.panel \
    dolibarr-edu/nginx-panel.conf \
    dolibarr-edu/.env.example 2>/dev/null || true
  success "Ficheros actualizados desde GitHub"
else
  info "Clonando repositorio..."
  _sudo git clone --depth 1 --branch "$BRANCH" "$REPO" "$REPO_DIR"
  _sudo chown -R "$USER:$USER" "$REPO_DIR" 2>/dev/null || true
  success "Repositorio en $REPO_DIR"
fi

# ── Crear .env si no existe ───────────────────────────────────────────────────
if [[ ! -f "$WORK_DIR/.env" ]]; then
  cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"
  info "Generando contraseñas aleatorias..."

  sed -i "s|cambia_esta_contrasena_root|$(gen_pass 24)|g"             "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_db|$(gen_pass 24)|g"               "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_openproject|$(gen_pass 24)|g"      "$WORK_DIR/.env"
  sed -i "s|cambia_esta_clave_secreta_openproject|$(openssl rand -hex 64)|g" "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_collabora|$(gen_pass 20)|g"        "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_nc_root|$(gen_pass 24)|g"          "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_nc_db|$(gen_pass 24)|g"            "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_nc_admin|$(gen_pass 20)|g"         "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_panel|$(gen_pass 24)|g"            "$WORK_DIR/.env"
  sed -i "s|cambia_esta_clave_sesion|$(gen_pass 48)|g"                "$WORK_DIR/.env"

  DOLI_ADMIN_PASS=$(gen_pass 16)
  sed -i "s|cambia_esta_contrasena_admin|$DOLI_ADMIN_PASS|g"          "$WORK_DIR/.env"
  success ".env creado con contraseñas generadas"
else
  warn ".env ya existe — se mantiene la configuración actual."
  DOLI_ADMIN_PASS="(ver $WORK_DIR/.env → DOLI_ADMIN_PASSWORD)"
fi

# ── Contraseña del panel web ──────────────────────────────────────────────────
CURRENT_HASH=$(grep "^ADMIN_PASSWORD_HASH=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
if [[ -z "$CURRENT_HASH" ]]; then
  echo ""
  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}│         Contraseña del Panel de Gestión                  │${NC}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
  echo ""
  echo "  Elige la contraseña de acceso al panel de profesores."
  echo ""
  while true; do
    read -rsp "  Contraseña del panel: " PANEL_PASS < /dev/tty; echo ""
    read -rsp "  Confirmar contraseña:  " PANEL_PASS2 < /dev/tty; echo ""
    [[ -n "$PANEL_PASS" && "$PANEL_PASS" == "$PANEL_PASS2" ]] && break
    echo -e "  ${RED}Las contraseñas no coinciden o están vacías. Inténtalo de nuevo.${NC}"
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

CURRENT_DOLI_URL=$(grep "^DOLI_URL_ROOT=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
read -rp "  URL de Dolibarr ERP       [${CURRENT_DOLI_URL:-https://erp.micentro.es}]: " DOLI_URL < /dev/tty
DOLI_URL="${DOLI_URL:-${CURRENT_DOLI_URL:-https://erp.micentro.es}}"
DOLI_DOMAIN=$(echo "$DOLI_URL" | sed 's|https\?://||' | cut -d'/' -f1)

CURRENT_PANEL_URL=$(grep "^PANEL_URL=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
read -rp "  URL del Panel de gestión  [${CURRENT_PANEL_URL:-https://panel.micentro.es}]: " PANEL_URL < /dev/tty
PANEL_URL="${PANEL_URL:-${CURRENT_PANEL_URL:-https://panel.micentro.es}}"

CURRENT_OP_HOST=$(grep "^OP_HOST=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
read -rp "  Dominio de OpenProject    [${CURRENT_OP_HOST:-proyectos.micentro.es}]: " OP_HOST < /dev/tty
OP_HOST="${OP_HOST:-${CURRENT_OP_HOST:-proyectos.micentro.es}}"

CURRENT_OFFICE=$(grep "^OFFICE_HOST=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
read -rp "  Dominio de Collabora      [${CURRENT_OFFICE:-office.micentro.es}]: " OFFICE_HOST < /dev/tty
OFFICE_HOST="${OFFICE_HOST:-${CURRENT_OFFICE:-office.micentro.es}}"

CURRENT_NC_HOST=$(grep "^NC_HOST=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
read -rp "  Dominio de Nextcloud      [${CURRENT_NC_HOST:-cloud.micentro.es}]: " NC_HOST < /dev/tty
NC_HOST="${NC_HOST:-${CURRENT_NC_HOST:-cloud.micentro.es}}"

# Actualizar .env
sed -i "s|^DOLI_URL_ROOT=.*|DOLI_URL_ROOT=$DOLI_URL|"             "$WORK_DIR/.env"
sed -i "s|^DOLI_DOMAIN=.*|DOLI_DOMAIN=$DOLI_DOMAIN|"               "$WORK_DIR/.env"
sed -i "s|^DOLIBARR_BASE_URL=.*|DOLIBARR_BASE_URL=$DOLI_URL|"     "$WORK_DIR/.env"
sed -i "s|^OP_HOST=.*|OP_HOST=$OP_HOST|"                           "$WORK_DIR/.env"
sed -i "s|^PANEL_URL=.*|PANEL_URL=$PANEL_URL|"                     "$WORK_DIR/.env"

# Asegurarse de que OFFICE_HOST está en .env
if grep -q "^OFFICE_HOST=" "$WORK_DIR/.env"; then
  sed -i "s|^OFFICE_HOST=.*|OFFICE_HOST=$OFFICE_HOST|"             "$WORK_DIR/.env"
else
  echo "OFFICE_HOST=$OFFICE_HOST"                                >> "$WORK_DIR/.env"
fi

# Asegurarse de que NC_HOST está en .env
if grep -q "^NC_HOST=" "$WORK_DIR/.env"; then
  sed -i "s|^NC_HOST=.*|NC_HOST=$NC_HOST|"                         "$WORK_DIR/.env"
else
  echo "NC_HOST=$NC_HOST"                                        >> "$WORK_DIR/.env"
fi
success "URLs configuradas"

# ── Cloudflare Tunnel token (opcional) ────────────────────────────────────────
echo ""
echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│           Cloudflare Tunnel (opcional)                   │${NC}"
echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
echo ""

CURRENT_CF_TOKEN=$(grep "^CLOUDFLARE_TOKEN=" "$WORK_DIR/.env" 2>/dev/null | cut -d'=' -f2 || true)
if [[ -n "$CURRENT_CF_TOKEN" ]]; then
  success "Token de Cloudflare ya configurado"
else
  echo "  Pega el token de tu túnel Cloudflare para que el acceso externo"
  echo "  funcione automáticamente. Si no lo tienes ahora, pulsa Enter para"
  echo "  omitir y configúralo después en $WORK_DIR/.env"
  echo ""
  echo "  (Dashboard Cloudflare → Zero Trust → Networks → Tunnels → tu túnel"
  echo "   → Configure → Overview → copia el token del comando de instalación)"
  echo ""
  read -rp "  Token de Cloudflare (o Enter para omitir): " CF_TOKEN < /dev/tty
  if [[ -n "$CF_TOKEN" ]]; then
    if grep -q "^CLOUDFLARE_TOKEN=" "$WORK_DIR/.env"; then
      sed -i "s|^CLOUDFLARE_TOKEN=.*|CLOUDFLARE_TOKEN=$CF_TOKEN|" "$WORK_DIR/.env"
    else
      echo "CLOUDFLARE_TOKEN=$CF_TOKEN" >> "$WORK_DIR/.env"
    fi
    success "Token de Cloudflare guardado"
  else
    info "Cloudflare omitido. Añade CLOUDFLARE_TOKEN en $WORK_DIR/.env cuando lo tengas."
    # Asegurarse de que la clave existe aunque vacía
    grep -q "^CLOUDFLARE_TOKEN=" "$WORK_DIR/.env" || echo "CLOUDFLARE_TOKEN=" >> "$WORK_DIR/.env"
  fi
fi

# ── Resumen de credenciales ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        GUARDA ESTAS CREDENCIALES EN LUGAR SEGURO            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf  "║  %-28s %-31s║\n" "Dolibarr admin:" "admin / $DOLI_ADMIN_PASS"
printf  "║  %-28s %-31s║\n" "OpenProject:" "admin / admin (cámbiala)"
printf  "║  %-28s %-31s║\n" "Nextcloud:" "admin / (ver .env → NC_ADMIN_PASSWORD)"
echo "╠══════════════════════════════════════════════════════════════╣"
printf  "║  %-28s %-31s║\n" "Dolibarr ERP:" "$DOLI_URL"
printf  "║  %-28s %-31s║\n" "Panel de gestión:" "$PANEL_URL"
printf  "║  %-28s %-31s║\n" "OpenProject:" "https://$OP_HOST"
printf  "║  %-28s %-31s║\n" "Collabora Online:" "https://$OFFICE_HOST"
printf  "║  %-28s %-31s║\n" "Nextcloud:" "https://$NC_HOST"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── Arrancar servicios ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}│           Arrancar servicios                             │${NC}"
echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
echo ""
echo "  Las imágenes del panel se construyen localmente (Node.js + React)."
echo "  Este proceso tarda ~5-10 minutos la primera vez."
echo ""
read -rp "  ¿Construir imágenes y arrancar todos los servicios ahora? [S/n]: " START_NOW < /dev/tty
START_NOW="${START_NOW:-S}"

if [[ "${START_NOW,,}" != "n" && "${START_NOW,,}" != "no" ]]; then
  cd "$WORK_DIR"

  info "Construyendo imágenes del panel (esto tarda unos minutos)..."
  docker compose build panel_api panel_web

  info "Arrancando todos los servicios..."
  docker compose up -d

  info "Esperando a que la base de datos del panel esté lista..."
  sleep 15

  info "Aplicando schema de base de datos del panel..."
  docker compose run --rm panel_api sh -c \
    "DATABASE_URL=postgresql://panel:\${PANEL_DB_PASSWORD}@panel_db:5432/panel node -e 'console.log(\"ok\")'" \
    2>/dev/null || true

  echo ""
  docker compose ps
  echo ""
  success "¡Todos los servicios en marcha!"
  echo ""
  echo "  Panel de gestión: $PANEL_URL"
  echo "  Dolibarr ERP:     $DOLI_URL"
  echo ""
  echo "  Si el panel da error al cargar, espera 1-2 min y recarga."
  echo "  Para aplicar el schema inicial de la BD del panel:"
  echo "    cd $WORK_DIR && docker compose exec panel_api sh"
else
  echo ""
  success "Configuración completada."
  echo ""
  echo "Próximos pasos:"
  echo ""
  echo "  1. Construir las imágenes del panel (una sola vez, ~5 min):"
  echo "     cd $WORK_DIR && docker compose build panel_api panel_web"
  echo ""
  echo "  2. Arrancar todos los servicios:"
  echo "     cd $WORK_DIR && docker compose up -d"
  echo ""
  echo "  3. Comprobar que todo está listo:"
  echo "     cd $WORK_DIR && docker compose ps"
fi

echo ""
[[ "$DOCKER_JUST_INSTALLED" == "true" ]] && \
  warn "RECUERDA: ejecuta 'newgrp docker' antes de docker compose (o cierra sesión y vuelve a entrar)."
