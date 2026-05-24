#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  crear-grupo.sh
#  Crea un profesor y el grupo de clase asociado en Dolibarr.
#  El profesor recibe permisos de administrador sobre las
#  empresas de sus alumnos.
#
#  Uso:
#    ./scripts/crear-grupo.sh \
#      --nombre "Ana García" \
#      --usuario "ana.garcia" \
#      --email "ana.garcia@centro.es" \
#      --grupo "1ASIR-A" \
#      --password "Contrasena123!"
#
#  Variables de entorno requeridas:
#    DOLI_URL      URL base de Dolibarr  (ej: http://localhost:8069)
#    DOLI_API_KEY  Clave API del superadmin
# ─────────────────────────────────────────────────────────

set -euo pipefail

DOLI_URL="${DOLI_URL:-http://localhost:8069}"
DOLI_API_KEY="${DOLI_API_KEY:-}"
API="${DOLI_URL}/api/index.php"

# ── Parseo de argumentos ──────────────────────────────────
NOMBRE="" USUARIO="" EMAIL="" GRUPO="" PASSWORD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --nombre)   NOMBRE="$2";   shift 2 ;;
    --usuario)  USUARIO="$2";  shift 2 ;;
    --email)    EMAIL="$2";    shift 2 ;;
    --grupo)    GRUPO="$2";    shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

for var in NOMBRE USUARIO EMAIL GRUPO PASSWORD; do
  if [[ -z "${!var}" ]]; then
    echo "ERROR: Falta el argumento --${var,,}"
    exit 1
  fi
done

if [[ -z "$DOLI_API_KEY" ]]; then
  echo "ERROR: Define DOLI_API_KEY"; exit 1
fi

call_api() {
  curl -s -X "$1" \
    -H "DOLAPIKEY: ${DOLI_API_KEY}" \
    -H "Content-Type: application/json" \
    ${3:+-d "$3"} \
    "${API}${2}"
}

echo "Creando profesor: $NOMBRE ($USUARIO) — Grupo: $GRUPO"

# 1. Crear usuario profesor
PROF_ID=$(call_api POST "/users" "{
  \"login\": \"$USUARIO\",
  \"pass\": \"$PASSWORD\",
  \"firstname\": \"$(echo $NOMBRE | cut -d' ' -f1)\",
  \"lastname\": \"$(echo $NOMBRE | cut -d' ' -f2-)\",
  \"email\": \"$EMAIL\",
  \"admin\": 0,
  \"note_public\": \"Profesor — Grupo: $GRUPO\"
}" | jq -r '.id // empty')

if [[ -z "$PROF_ID" ]]; then
  echo "ERROR: No se pudo crear el usuario. ¿Ya existe '$USUARIO'?"
  exit 1
fi
echo "  ✓ Usuario creado (ID: $PROF_ID)"

# 2. Asignar permisos de gestión de empresas (entidades)
call_api PUT "/users/$PROF_ID/setGroup" "{\"group\": 1}" > /dev/null
echo "  ✓ Permisos de gestión asignados"

# 3. Guardar mapeo grupo → profesor en notas internas
call_api POST "/documents" "{
  \"type\": \"ficheinter\",
  \"note_private\": \"GRUPO:$GRUPO|PROFESOR_ID:$PROF_ID|PROFESOR:$NOMBRE\"
}" > /dev/null 2>&1 || true

echo ""
echo "Grupo '$GRUPO' listo."
echo "  Usuario:    $USUARIO"
echo "  Contraseña: $PASSWORD"
echo "  ID interno: $PROF_ID"
echo ""
echo "  Ahora ejecuta crear-alumnos.sh con --grupo $GRUPO --profesor-id $PROF_ID"
