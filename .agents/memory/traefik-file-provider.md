---
name: Traefik file provider — extensiones aceptadas
description: El file provider de Traefik en modo directory solo carga .toml/.yml/.yaml — ignora .json sin loguear error.
---

Cuando Traefik (v2/v3) usa `--providers.file.directory=...`, el watcher detecta TODOS los ficheros del directorio (incluso `.json`) y reporta "add watcher on: ..." en debug, **pero solo parsea los que tienen extensión `.toml`, `.yml` o `.yaml`**. Los demás se descartan silenciosamente: la línea siguiente del log mostrará `Configuration received config={"http":{},"tcp":{},"tls":{},"udp":{}} providerName=file` — config vacía, sin error.

**Why:** descubierto al ver que un fichero `.json` válido con routers/services correctos no aplicaba ninguna regla y todas las peticiones daban 404 de Traefik, aunque Traefik podía alcanzar el upstream por nombre de contenedor.

**How to apply:** al generar configuración dinámica programáticamente, escribe `.yaml`. JSON es YAML válido, así que puedes seguir usando `JSON.stringify` para el contenido — solo cambia la extensión. Con `--providers.file.filename=X` (modo fichero único) sí acepta JSON; la restricción es exclusiva de `directory`.
