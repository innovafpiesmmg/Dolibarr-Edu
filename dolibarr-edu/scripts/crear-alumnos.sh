#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  crear-alumnos.sh
#  Da de alta alumnos desde un fichero CSV.
#  Por cada alumno crea:
#    1. Una entidad (empresa) en el módulo MultiCompany
#    2. Un usuario vinculado a esa entidad
#    3. Acceso del profesor-id a la entidad del alumno
#
#  Formato del CSV (sin cabecera):
#    nombre,apellidos,usuario,email,password,grupo
#
#  Ejemplo CSV (alumnos.csv):
#    Carlos,López Martín,carlos.lopez,carlos@centro.es,Pass123!,1ASIR-A
#    María,Sánchez Ruiz,maria.sanchez,maria@centro.es,Pass123!,1ASIR-A
#
#  Uso:
#    ./scripts/crear-alumnos.sh \
#      --csv alumnos.csv \
#      --profesor-id 5
#
#  Variables de entorno requeridas:
#    DOLI_URL      URL base de Dolibarr
#    DOLI_API_KEY  Clave API del superadmin
# ─────────────────────────────────────────────────────────

set -euo pipefail

DOLI_URL="${DOLI_URL:-http://localhost:8069}"
DOLI_API_KEY="${DOLI_API_KEY:-}"
API="${DOLI_URL}/api/index.php"

CSV_FILE="" PROFESOR_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --csv)          CSV_FILE="$2";     shift 2 ;;
    --profesor-id)  PROFESOR_ID="$2";  shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

[[ -z "$CSV_FILE" || ! -f "$CSV_FILE" ]] && { echo "ERROR: CSV no encontrado: $CSV_FILE"; exit 1; }
[[ -z "$PROFESOR_ID" ]] && { echo "ERROR: Indica --profesor-id"; exit 1; }
[[ -z "$DOLI_API_KEY" ]] && { echo "ERROR: Define DOLI_API_KEY"; exit 1; }

call_api() {
  curl -s -X "$1" \
    -H "DOLAPIKEY: ${DOLI_API_KEY}" \
    -H "Content-Type: application/json" \
    ${3:+-d "$3"} \
    "${API}${2}"
}

CREADOS=0 ERRORES=0

echo "======================================================"
echo "  Creando alumnos desde: $CSV_FILE"
echo "======================================================"

while IFS=',' read -r NOMBRE APELLIDOS USUARIO EMAIL PASSWORD GRUPO; do
  # Ignorar líneas vacías o comentarios
  [[ -z "$NOMBRE" || "$NOMBRE" == \#* ]] && continue

  NOMBRE_EMPRESA="${NOMBRE} ${APELLIDOS} — ${GRUPO}"

  echo -n "→ $NOMBRE $APELLIDOS ($USUARIO)... "

  # 1. Crear la entidad/empresa del alumno
  ENTITY_ID=$(call_api POST "/multicompany/entity" "{
    \"label\": \"$NOMBRE_EMPRESA\",
    \"description\": \"Empresa educativa — Alumno: $NOMBRE $APELLIDOS | Grupo: $GRUPO\",
    \"active\": 1
  }" | jq -r '.id // empty')

  if [[ -z "$ENTITY_ID" ]]; then
    echo "FALLO (no se creó la entidad)"
    ((ERRORES++))
    continue
  fi

  # 2. Crear usuario alumno vinculado a la entidad
  USER_ID=$(call_api POST "/users" "{
    \"login\": \"$USUARIO\",
    \"pass\": \"$PASSWORD\",
    \"firstname\": \"$NOMBRE\",
    \"lastname\": \"$APELLIDOS\",
    \"email\": \"$EMAIL\",
    \"admin\": 0,
    \"entity\": $ENTITY_ID,
    \"note_public\": \"Alumno FP | Grupo: $GRUPO | Empresa ID: $ENTITY_ID\"
  }" | jq -r '.id // empty')

  if [[ -z "$USER_ID" ]]; then
    echo "FALLO (no se creó el usuario, ¿login duplicado?)"
    ((ERRORES++))
    continue
  fi

  # 3. Dar acceso al profesor a la entidad del alumno
  call_api PUT "/multicompany/entity/$ENTITY_ID/user/$PROFESOR_ID" '{}' > /dev/null 2>&1 || true

  echo "OK (entidad: $ENTITY_ID, usuario: $USER_ID)"
  ((CREADOS++))

done < "$CSV_FILE"

echo ""
echo "======================================================"
echo "  Resultado: $CREADOS creados, $ERRORES errores"
echo "======================================================"
