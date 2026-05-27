---
name: Traefik docker provider incompatible con Docker Engine moderno
description: El docker provider de Traefik (v3.3–v3.5) negocia API 1.24 y falla contra daemons con MinAPIVersion ≥1.44 (Engine 25+/29+).
---

El cliente Go de Docker que embebe Traefik fija una versión de negociación antigua. Daemons modernos (`Docker Engine 25+`, confirmado con 29.2.1 en Ubuntu 25.04) tienen `MinAPIVersion=1.44` y devuelven `client version 1.24 is too old`. Ni actualizar Traefik a v3.5 ni proxificar el socket con `tecnativa/docker-socket-proxy` lo arregla — el problema está en el cliente de Traefik, no en el socket.

**Why:** descubierto tras intentar exponer Dolibarr por subdominio con labels Docker estándar — el provider ni siquiera enumeraba los contenedores. Cambiar a file provider (ficheros dinámicos generados por la app) lo solucionó de golpe.

**How to apply:** para enrutar dinámicamente con Traefik en entornos con Docker reciente, no uses el docker provider. Genera ficheros `.yaml` por servicio en un volumen compartido y arranca Traefik con `--providers.file.directory=/etc/traefik/dynamic --providers.file.watch=true`. La app que escribe los ficheros debe montar el mismo volumen `rw`.
