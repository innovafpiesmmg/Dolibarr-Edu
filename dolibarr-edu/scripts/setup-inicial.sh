#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  setup-inicial.sh
#  Configura Dolibarr para el entorno educativo de FP:
#   - Activa el módulo multiempresa
#   - Establece configuraciones base recomendadas
#
#  Uso:
#    chmod +x scripts/setup-inicial.sh
#    ./scripts/setup-inicial.sh
#
#  Requisitos:
#    - Dolibarr ya instalado y accesible
#    - curl, jq instalados en el servidor
#    - Variables DOLI_URL, DOLI_API_KEY definidas
# ─────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuración ─────────────────────────────────────────
DOLI_URL="${DOLI_URL:-http://localhost:8069}"
DOLI_API_KEY="${DOLI_API_KEY:-}"

if [[ -z "$DOLI_API_KEY" ]]; then
  echo "ERROR: Define la variable DOLI_API_KEY con la clave API del administrador."
  echo "  Puedes generarla en Dolibarr → Configuración → Seguridad → API"
  exit 1
fi

API="${DOLI_URL}/api/index.php"

call_api() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  curl -s -X "$method" \
    -H "DOLAPIKEY: ${DOLI_API_KEY}" \
    -H "Content-Type: application/json" \
    ${data:+-d "$data"} \
    "${API}${endpoint}"
}

echo "======================================================"
echo "  Dolibarr EDU — Configuración inicial"
echo "======================================================"

# Comprobación de conectividad
echo -n "→ Verificando conexión con Dolibarr... "
STATUS=$(call_api GET "/status" | jq -r '.success // empty')
if [[ "$STATUS" != "true" ]]; then
  echo "FALLO"
  echo "  No se pudo conectar. Comprueba que Dolibarr esté en marcha y la API activada."
  exit 1
fi
echo "OK"

# Activar módulo multiempresa vía configuración global
echo "→ Activando módulo MultiCompany..."
call_api PUT "/setup/conf" '{
  "constname": "MAIN_MODULE_MULTICOMPANY",
  "constvalue": "1"
}' > /dev/null

# Ajustes recomendados para entorno educativo
echo "→ Aplicando ajustes para entorno educativo..."

declare -A SETTINGS=(
  ["MAIN_DISABLE_CONTACTS_TAB"]="1"
  ["MAIN_FEATURES_LEVEL"]="0"
  ["SOCIETE_CODECLIENT_ADDON"]="mod_codeclient_leopard"
  ["MAIN_LANG_DEFAULT"]="es_ES"
  ["MAIN_DEFAULT_BROWSER_TIMEZONE"]="1"
)

for key in "${!SETTINGS[@]}"; do
  call_api PUT "/setup/conf" "{\"constname\": \"$key\", \"constvalue\": \"${SETTINGS[$key]}\"}" > /dev/null
done

echo ""
echo "======================================================"
echo "  ¡Configuración inicial completada!"
echo ""
echo "  Próximos pasos:"
echo "    1. Ejecuta crear-grupo.sh para crear profesores y grupos"
echo "    2. Ejecuta crear-alumnos.sh para dar de alta alumnos"
echo "======================================================"
