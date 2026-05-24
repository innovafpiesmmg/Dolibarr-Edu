#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  install.sh — Dolibarr EDU
#  Descarga e instala Dolibarr EDU desde GitHub
#  Repositorio: https://github.com/innovafpiesmmg/Dolibarr-Edu
#
#  Uso:
#    curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/install.sh | bash
#  o bien:
#    chmod +x install.sh && ./install.sh
#
#  Requisitos:
#    - Ubuntu 22.04 / Debian 12 (o compatible)
#    - Usuario con sudo
#    - Conexión a internet
# ─────────────────────────────────────────────────────────

set -euo pipefail

REPO="https://github.com/innovafpiesmmg/Dolibarr-Edu"
INSTALL_DIR="${INSTALL_DIR:-/opt/dolibarr-edu}"
BRANCH="${BRANCH:-main}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Dolibarr EDU — Instalación                  ║"
echo "║  ERP para FP Administración de Empresas              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Comprobaciones previas ────────────────────────────────
[[ $EUID -eq 0 ]] && error "No ejecutes este script como root directamente. Usa un usuario con sudo."

command -v sudo >/dev/null 2>&1  || error "sudo no está disponible"

# ── Instalar Docker si no está ───────────────────────────
if ! command -v docker &>/dev/null; then
  info "Docker no encontrado. Instalando..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  success "Docker instalado. NOTA: Cierra sesión y vuelve a entrar para que los cambios de grupo surtan efecto."
  DOCKER_JUST_INSTALLED=true
else
  success "Docker ya está instalado ($(docker --version | cut -d' ' -f3 | tr -d ','))"
  DOCKER_JUST_INSTALLED=false
fi

# ── Instalar git si no está ──────────────────────────────
if ! command -v git &>/dev/null; then
  info "Instalando git..."
  sudo apt-get update -qq && sudo apt-get install -y git
  success "git instalado"
fi

# ── Clonar o actualizar el repositorio ───────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "El directorio $INSTALL_DIR ya existe. Usa update.sh para actualizar."
  exit 0
fi

info "Clonando repositorio desde $REPO..."
sudo git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR"
sudo chown -R "$USER:$USER" "$INSTALL_DIR"
success "Repositorio descargado en $INSTALL_DIR"

# ── Crear fichero .env ────────────────────────────────────
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"

  # Generar contraseñas aleatorias para la base de datos
  ROOT_PASS=$(openssl rand -base64 20 | tr -dc 'a-zA-Z0-9' | head -c 20)
  DB_PASS=$(openssl rand -base64 20 | tr -dc 'a-zA-Z0-9' | head -c 20)
  ADMIN_PASS=$(openssl rand -base64 20 | tr -dc 'a-zA-Z0-9' | head -c 20)
  SESSION_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)

  sed -i "s/cambia_esta_contrasena_root/$ROOT_PASS/"   "$INSTALL_DIR/.env"
  sed -i "s/cambia_esta_contrasena_db/$DB_PASS/"       "$INSTALL_DIR/.env"
  sed -i "s/cambia_esta_contrasena_admin/$ADMIN_PASS/" "$INSTALL_DIR/.env"

  # ── Contraseña de acceso al panel ─────────────────────
  echo ""
  echo "┌─────────────────────────────────────────────────────┐"
  echo "│              Configuración del panel web             │"
  echo "└─────────────────────────────────────────────────────┘"
  echo ""
  echo "  El panel de gestión (profesores, grupos, alumnos) está"
  echo "  protegido con contraseña. Elige una contraseña segura."
  echo ""
  while true; do
    read -rsp "  Contraseña del panel: " PANEL_PASS
    echo ""
    read -rsp "  Confirmar contraseña:  " PANEL_PASS2
    echo ""
    if [[ "$PANEL_PASS" == "$PANEL_PASS2" ]]; then
      break
    fi
    echo -e "  ${RED}Las contraseñas no coinciden. Inténtalo de nuevo.${NC}"
  done

  PANEL_HASH=$(echo -n "$PANEL_PASS" | openssl dgst -sha256 | awk '{print $2}')
  sed -i "s|^ADMIN_PASSWORD_HASH=.*|ADMIN_PASSWORD_HASH=$PANEL_HASH|" "$INSTALL_DIR/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|"       "$INSTALL_DIR/.env"

  # ── URL del servidor Dolibarr ─────────────────────────
  echo ""
  echo "┌─────────────────────────────────────────────────────┐"
  echo "│          URL pública de Dolibarr (para alumnos)      │"
  echo "└─────────────────────────────────────────────────────┘"
  echo ""
  echo "  Introduce la URL pública de tu instancia Dolibarr."
  echo "  Ejemplo: https://erp.micentro.es"
  echo "  (Puedes dejarlo vacío ahora y configurarlo después en .env)"
  echo ""
  read -rp "  URL de Dolibarr: " DOLI_URL
  DOLI_URL="${DOLI_URL:-}"
  sed -i "s|^DOLIBARR_BASE_URL=.*|DOLIBARR_BASE_URL=${DOLI_URL}|" "$INSTALL_DIR/.env"

  echo ""
  echo "┌─────────────────────────────────────────────────────┐"
  echo "│  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO        │"
  echo "├─────────────────────────────────────────────────────┤"
  echo "│  Usuario admin Dolibarr: admin                       │"
  echo "│  Contraseña admin:       $ADMIN_PASS                 │"
  echo "└─────────────────────────────────────────────────────┘"
  echo ""
  warn "La contraseña del panel queda guardada como hash en $INSTALL_DIR/.env"
fi

# ── Instrucciones finales ─────────────────────────────────
echo ""
success "¡Instalación completada!"
echo ""
echo "Próximos pasos:"
echo ""
echo "  1. Revisa la configuración (opcional):"
echo "     nano $INSTALL_DIR/.env"
echo ""
echo "  2. Arranca los servicios:"
echo "     cd $INSTALL_DIR && docker compose up -d"
echo ""
echo "  3. Configura el túnel Cloudflare:"
echo "     Sigue las instrucciones en $INSTALL_DIR/cloudflare/config.yml"
echo ""
echo "  4. Configura el entorno educativo:"
echo "     cd $INSTALL_DIR && ./scripts/setup-inicial.sh"
echo ""
if [[ "$DOCKER_JUST_INSTALLED" == "true" ]]; then
  warn "Recuerda: Cierra sesión y vuelve a entrar antes de ejecutar docker compose."
fi
