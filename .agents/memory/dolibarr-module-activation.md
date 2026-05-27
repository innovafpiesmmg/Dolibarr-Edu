---
name: Dolibarr — activación de módulos por SQL
description: Reglas no-obvias para activar módulos de Dolibarr escribiendo directamente en llx_const desde otro proceso (sin pasar por la UI de admin).
---

# Activar módulos Dolibarr vía SQL

Cuando se activa un módulo desde la UI de admin, Dolibarr escribe filas en `llx_const`. Si se quiere automatizar desde fuera (otro servicio que toca la BD del alumno), hay que reproducir ese estado.

## Regla 1 — `entity = 1`, NO `entity = 0`

Las constantes `MAIN_MODULE_<X>` se almacenan con la entidad activa. En instalaciones single-tenant la entidad por defecto es `1`. Insertar con `entity = 0` **no activa el módulo** (Dolibarr no lo reconoce y los menús no aparecen), aunque la fila exista.

**Cómo aplicarlo:** todas las filas que se inserten en `llx_const` para activación de módulo deben usar `entity=1`. Solo constantes globales de instalación (poquísimas) usan `entity=0`.

## Regla 2 — La constante NO siempre es el nombre PHP en mayúsculas

La constante guardada es `MAIN_MODULE_<X>` donde `<X>` es el atributo `$this->name` de la clase `modXxx.class.php`, no el nombre del archivo PHP. Pares confusos confirmados:

| Clase PHP        | Constante (`MAIN_MODULE_<X>`) |
|------------------|--------------------------------|
| `modProjet`      | `PROJET` (NO `PROJECT`)        |
| `modHolidays`    | `HOLIDAY` (singular)           |
| `modExpenseReport` | `EXPENSEREPORT`              |
| `modPrelevement` | `PRELEVEMENT`                  |
| `modFournisseur` | `FOURNISSEUR`                  |
| `modContrat`     | `CONTRAT`                      |
| `modCategorie`   | `CATEGORIE`                    |

**Cómo aplicarlo:** si necesitas otro módulo, verifica el `$this->name` en `htdocs/core/modules/mod<Xxx>.class.php` del Dolibarr de la versión que usas antes de añadirlo a la lista. No asumas que `modFoo` → `FOO`.

## Regla 3 — Insertar también los sub-flags

Para que el módulo aparezca en menús/triggers/hooks, además de `MAIN_MODULE_<X>` hay que escribir los sub-flags activos:
- `MAIN_MODULE_<X>_TRIGGERS`
- `MAIN_MODULE_<X>_HOOKS`
- `MAIN_MODULE_<X>_LOGIN`
- `MAIN_MODULE_<X>_MENUS`
- `MAIN_MODULE_<X>_SUBSTITUTIONS`

Todos con `value='1'`, `entity=1`, `type='chaine'`.

## Regla 4 — Usar `ON DUPLICATE KEY UPDATE value='1'`, no `INSERT IGNORE`

Si un módulo ya existe en `llx_const` pero con `value='0'` (desactivado), `INSERT IGNORE` no hace nada → el módulo sigue desactivado. Hace falta `ON DUPLICATE KEY UPDATE value='1'` para que la operación sea idempotente *y* reactivadora.

## Regla 5 — No hace falta reiniciar el contenedor

Dolibarr lee `llx_const` en cada request. Tras escribir las filas, los módulos están activos para el siguiente request del alumno.

**Por qué importa esto:** un botón "Activar módulos" en la UI del panel puede funcionar aunque el contenedor del alumno esté parado — solo necesita conectividad MariaDB, no Dolibarr arrancado.

## Por qué no usar solo `DOLI_MODULES` de la imagen oficial

La imagen `dolibarr/dolibarr` lee `DOLI_MODULES=modA,modB,...` y activa los módulos en el primer arranque. Pero:

- Solo se aplica en el **primer arranque** (instalación inicial). En reinicios siguientes no se reaplica.
- No cubre alumnos ya desplegados antes de ampliar la lista.

Por eso la estrategia robusta es: `DOLI_MODULES` para el deploy inicial, + fallback SQL después del health-check, + endpoint para reaplicar manualmente.
