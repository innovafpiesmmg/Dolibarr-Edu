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
#    - Usuario con sudo
#    - Conexión a internet
# ─────────────────────────────────────────────────────────

set -euo pipefail

REPO="https://github.com/innovafpiesmmg/Dolibarr-Edu"
REPO_DIR="${REPO_DIR:-/opt/dolibarr-edu}"
BRANCH="${BRANCH:-main}"

# WORK_DIR es la subcarpeta del repo que contiene docker-compose y scripts
WORK_DIR="$REPO_DIR/dolibarr-edu"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ERP EDU — Instalación                      ║"
echo "║  ERP + OpenProject + Collabora Online para FP               ║"
echo "║  https://github.com/innovafpiesmmg/Dolibarr-Edu             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Comprobaciones previas ────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] && error "No ejecutes este script como root. Usa un usuario con sudo."
command -v sudo >/dev/null 2>&1 || error "sudo no está disponible en este sistema."

# ── Instalación ya existente ──────────────────────────────────────────────────
if [[ -d "$WORK_DIR" ]]; then
  warn "Ya existe una instalación en $WORK_DIR."
  warn "Para actualizar usa:  curl -fsSL https://raw.githubusercontent.com/innovafpiesmmg/Dolibarr-Edu/main/update.sh | bash"
  exit 0
fi

# ── Actualizar paquetes e instalar dependencias ───────────────────────────────
info "Actualizando lista de paquetes del sistema..."
sudo apt-get update -qq

for PKG in curl git openssl; do
  if ! command -v "$PKG" &>/dev/null; then
    info "Instalando $PKG..."
    sudo apt-get install -y "$PKG"
    success "$PKG instalado"
  else
    success "$PKG ya disponible"
  fi
done

# ── Instalar Docker si no está ────────────────────────────────────────────────
DOCKER_JUST_INSTALLED=false
if ! command -v docker &>/dev/null; then
  info "Docker no encontrado. Instalando Docker Engine..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  success "Docker instalado correctamente."
  warn "IMPORTANTE: Cierra sesión y vuelve a entrar para que los cambios de grupo (docker) surtan efecto."
  DOCKER_JUST_INSTALLED=true
else
  success "Docker ya instalado ($(docker --version | cut -d' ' -f3 | tr -d ','))"
fi

# ── Clonar repositorio ────────────────────────────────────────────────────────
info "Clonando repositorio desde $REPO..."
sudo git clone --depth 1 --branch "$BRANCH" "$REPO" "$REPO_DIR"
sudo chown -R "$USER:$USER" "$REPO_DIR"
success "Repositorio descargado en $REPO_DIR"
success "Archivos de despliegue en $WORK_DIR"

# ── Crear fichero .env ────────────────────────────────────────────────────────
if [[ ! -f "$WORK_DIR/.env" ]]; then
  cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"

  # ── Generar contraseñas aleatorias ─────────────────────────────────────────
  gen_pass() { openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c "${1:-24}"; }

  MYSQL_ROOT_PASS=$(gen_pass 24)
  MYSQL_PASS=$(gen_pass 24)
  DOLI_ADMIN_PASS=$(gen_pass 16)
  SESSION_SECRET=$(gen_pass 48)
  OP_DB_PASS=$(gen_pass 24)
  OP_SECRET=$(openssl rand -hex 64)
  COLLABORA_PASS=$(gen_pass 20)

  sed -i "s|cambia_esta_contrasena_root|$MYSQL_ROOT_PASS|g"          "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_db|$MYSQL_PASS|g"                 "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_admin|$DOLI_ADMIN_PASS|g"         "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_openproject|$OP_DB_PASS|g"        "$WORK_DIR/.env"
  sed -i "s|cambia_esta_clave_secreta_openproject|$OP_SECRET|g"      "$WORK_DIR/.env"
  sed -i "s|cambia_esta_contrasena_collabora|$COLLABORA_PASS|g"      "$WORK_DIR/.env"
  sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|"      "$WORK_DIR/.env"

  # ── Contraseña del panel web ────────────────────────────────────────────────
  echo ""
  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}│         Contraseña del Panel de Gestión                  │${NC}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
  echo ""
  echo "  El panel de gestión (profesores, grupos, alumnos) está"
  echo "  protegido con contraseña. Elige una contraseña segura."
  echo ""
  while true; do
    read -rsp "  Contraseña del panel: " PANEL_PASS; echo ""
    read -rsp "  Confirmar contraseña:  " PANEL_PASS2; echo ""
    [[ "$PANEL_PASS" == "$PANEL_PASS2" ]] && break
    echo -e "  ${RED}Las contraseñas no coinciden. Inténtalo de nuevo.${NC}"
  done
  PANEL_HASH=$(echo -n "$PANEL_PASS" | openssl dgst -sha256 | awk '{print $2}')
  sed -i "s|^ADMIN_PASSWORD_HASH=.*|ADMIN_PASSWORD_HASH=$PANEL_HASH|" "$WORK_DIR/.env"

  # ── URLs públicas ───────────────────────────────────────────────────────────
  echo ""
  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}│           URLs públicas (dominios del centro)            │${NC}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
  echo ""
  echo "  Introduce los dominios públicos de cada servicio."
  echo "  Puedes dejarlos vacíos ahora y configurarlos después en .env"
  echo ""
  read -rp "  URL de Dolibarr ERP     [https://erp.micentro.es]: " DOLI_URL
  DOLI_URL="${DOLI_URL:-https://erp.micentro.es}"
  DOLI_DOMAIN=$(echo "$DOLI_URL" | sed 's|https\?://||' | cut -d'/' -f1)

  read -rp "  Dominio de OpenProject  [proyectos.micentro.es]: "   OP_HOST
  OP_HOST="${OP_HOST:-proyectos.micentro.es}"

  read -rp "  Dominio de Collabora    [office.micentro.es]: "      OFFICE_HOST
  OFFICE_HOST="${OFFICE_HOST:-office.micentro.es}"

  sed -i "s|^DOLI_URL_ROOT=.*|DOLI_URL_ROOT=$DOLI_URL|"              "$WORK_DIR/.env"
  sed -i "s|^DOLI_DOMAIN=.*|DOLI_DOMAIN=$DOLI_DOMAIN|"               "$WORK_DIR/.env"
  sed -i "s|^DOLIBARR_BASE_URL=.*|DOLIBARR_BASE_URL=$DOLI_URL|"      "$WORK_DIR/.env"
  sed -i "s|^OP_HOST=.*|OP_HOST=$OP_HOST|"                           "$WORK_DIR/.env"

  # ── Resumen de credenciales ─────────────────────────────────────────────────
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO               ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  printf  "║  %-30s %-29s║\n" "Dolibarr admin usuario:" "admin"
  printf  "║  %-30s %-29s║\n" "Dolibarr admin contraseña:" "$DOLI_ADMIN_PASS"
  printf  "║  %-30s %-29s║\n" "OpenProject admin usuario:" "admin"
  printf  "║  %-30s %-29s║\n" "OpenProject admin contraseña:" "admin (cámbiala al entrar)"
  printf  "║  %-30s %-29s║\n" "Collabora admin usuario:" "admin"
  printf  "║  %-30s %-29s║\n" "Collabora admin contraseña:" "$COLLABORA_PASS"
  echo "╠══════════════════════════════════════════════════════════════╣"
  printf  "║  %-30s %-29s║\n" "Dolibarr ERP:" "$DOLI_URL"
  printf  "║  %-30s %-29s║\n" "OpenProject:" "https://$OP_HOST"
  printf  "║  %-30s %-29s║\n" "Collabora Online:" "https://$OFFICE_HOST"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  warn "La contraseña del panel está guardada como hash en $WORK_DIR/.env"
fi

# ── Instrucciones finales ─────────────────────────────────────────────────────
echo ""
success "¡Instalación completada!"
echo ""
echo "Próximos pasos:"
echo ""
echo "  1. (Opcional) Revisa y ajusta la configuración:"
echo "     nano $WORK_DIR/.env"
echo ""
echo "  2. Arranca todos los servicios:"
echo "     cd $WORK_DIR && docker compose up -d"
echo ""
echo "  3. Espera a que OpenProject termine su arranque inicial (~3 min):"
echo "     cd $WORK_DIR && docker compose logs -f openproject"
echo "     (Ctrl+C cuando veas 'listening on...')"
echo ""
echo "  4. Configura el túnel Cloudflare:"
echo "     Sigue las instrucciones en $WORK_DIR/cloudflare/config.yml"
echo ""
echo "  5. Configuración inicial del entorno educativo:"
echo "     cd $WORK_DIR && ./scripts/setup-inicial.sh"
echo ""
if [[ "$DOCKER_JUST_INSTALLED" == "true" ]]; then
  warn "RECUERDA: Cierra sesión y vuelve a entrar antes de ejecutar 'docker compose'."
  warn "O ejecuta:  newgrp docker"
fi
