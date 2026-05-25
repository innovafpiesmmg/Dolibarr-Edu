#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  listar-grupos.sh
#  Muestra todos los grupos/profesores y cuántos alumnos
#  (entidades) tiene cada uno.
#
#  Uso:
#    ./scripts/listar-grupos.sh
# ─────────────────────────────────────────────────────────

set -euo pipefail

DOLI_URL="${DOLI_URL:-http://localhost:8069}"
DOLI_API_KEY="${DOLI_API_KEY:-}"
API="${DOLI_URL}/api/index.php"

[[ -z "$DOLI_API_KEY" ]] && { echo "ERROR: Define DOLI_API_KEY"; exit 1; }

call_api() {
  curl -s -X "$1" \
    -H "DOLAPIKEY: ${DOLI_API_KEY}" \
    -H "Content-Type: application/json" \
    "${API}${2}"
}

echo "======================================================"
echo "  ERP EDU — Grupos y alumnos"
echo "======================================================"

ENTITIES=$(call_api GET "/multicompany/entity?limit=500")
USERS=$(call_api GET "/users?limit=500")

echo ""
echo "Entidades (empresas de alumnos):"
echo "$ENTITIES" | jq -r '.[] | "  ID:\(.id)  Nombre:\(.label)"' 2>/dev/null || echo "  (sin datos — comprueba la API)"

echo ""
echo "Usuarios:"
echo "$USERS" | jq -r '.[] | "  \(.login)  \(.firstname) \(.lastname)  (entidad:\(.entity // "principal"))"' 2>/dev/null || echo "  (sin datos)"
