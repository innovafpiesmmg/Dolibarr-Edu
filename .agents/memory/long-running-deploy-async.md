---
name: Despliegues largos detrás de proxy = async + enum exhaustivo
description: Cualquier op >100s (proxy timeout) debe responder 202 con un estado nuevo, y la UI debe enumerarlo explícitamente o muestra "error desconocido".
---

Cualquier operación que pueda exceder el timeout del proxy del entorno (típicamente 100s en Replit / Cloudflare) **no puede** completarse dentro del request HTTP. Patrón obligatorio:

1. Backend responde 202 inmediatamente con un estado nuevo (p.ej. `"deploying"`), persiste estado intermedio en BD, lanza el trabajo en background con `void (async () => {...})()`.
2. El estado nuevo debe añadirse al enum del OpenAPI (response schemas) Y al enum de BD si se persiste.
3. **Todos** los `handleX` del frontend que consumen ese response deben tener una rama explícita para el nuevo estado. Si no, caen al `else` final y disparan "Error desconocido" — un falso positivo que parece un bug del backend pero es de la UI.
4. La UI muestra el progreso real polleando un endpoint `/state` cada N segundos.

**Why:** En este repo, al pivotar el deploy de Dolibarr a async (necesario porque `waitForHttpHealthy` tarda hasta 180s y el proxy corta a 100s), el backend empezó a devolver `status:"deploying"` correctamente, pero 3 páginas del panel (`alumnos/detail`, `estado/index`, `profesores/detail`) solo cubrían `synced|skipped|error`. Resultado: deploy real funcionaba, UI mostraba "Error al desplegar: Error desconocido". Diagnóstico costoso porque los logs del API se ven perfectos.

**How to apply:** Al añadir un estado intermedio al enum de un response, hacer `rg 'result\.status|r\.status' artifacts/<app>/src/pages` y verificar que cada handler tiene rama explícita. El typecheck lo cazará si el enum del OpenAPI está actualizado *antes* de tocar la UI — añadir el enum primero, regenerar codegen, dejar que TS rompa donde falten ramas.

Además: el catch de los background jobs debe usar `describeError(err)` (no `err instanceof Error ? err.message : "Error desconocido"`) porque mysql2 y dockerode lanzan objetos planos con `code`/`sqlMessage`/`errno` que no son instancias de `Error`. Sin esto, la causa real (ECONNREFUSED, EACCES /var/run/docker.sock, etc.) se pierde.
