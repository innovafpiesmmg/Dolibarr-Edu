---
name: Cloudflare Tunnel wildcard DNS
description: Wildcard subdomains via CF Tunnel requieren un CNAME DNS manual al UUID del túnel; el síntoma de un CNAME mal apuntado es 524 silencioso sin tráfico en el connector.
---

# Wildcard CNAME para Cloudflare Tunnel

Cuando se añade un **public hostname concreto** (`panel.example.com`) en CF Tunnel, Cloudflare crea automáticamente el CNAME en DNS. **Para wildcards (`*.example.com`) NO siempre lo crea, o lo crea apuntando al apex del propio dominio — el panel UI no avisa.**

## Síntoma

- El public hostname `*.example.com → http://traefik:80` aparece correctamente listado en el túnel.
- `dig +short sub.example.com` devuelve IPs de Cloudflare (parece OK).
- El navegador da **524 Timeout** persistente.
- `docker logs cloudflared` **no muestra nada** cuando se hace la petición — la petición nunca llega al connector.
- Tests internos contenedor-a-contenedor (alpine → traefik con Host correcto) devuelven `200 OK`, descartando Traefik/Docker.

## Causa típica

El registro DNS `*` está como `CNAME → example.com` (al propio apex) en lugar de `CNAME → <tunnel-uuid>.cfargotunnel.com`. CF acepta el CNAME pero las IPs A del apex no están asociadas al túnel, así que CF no encuentra a quién enviar la petición → 524.

## Fix

Cloudflare Dashboard → DNS → Records → editar (o crear) el registro:

- Name: `*`
- Type: `CNAME`
- Target: `<tunnel-uuid>.cfargotunnel.com` (mismo UUID que reporta `cloudflared` en sus logs: `tunnelID=...`)
- Proxy status: Proxied (naranja)

Comparar con otros registros que sí funcionan en la misma zona — todos deben acabar en `<uuid>.cfargotunnel.com`.

## Cómo diagnosticarlo rápido

1. `docker logs --since 30s -f cloudflared` y recargar la URL desde el navegador.
2. Si no aparece nada → la petición no entra al túnel, casi seguro DNS mal.
3. Mirar el registro en CF DNS UI (no `dig`, porque al estar Proxied oculta el CNAME real y devuelve IPs A).

**Por qué:** un fallo silencioso del UI de CF — añadir el hostname al túnel parece suficiente, pero el DNS wildcard requiere intervención manual y es fácil apuntarlo mal sin que nada lo señale.

**Cómo aplicar:** siempre que un wildcard por túnel dé 524 y el connector no vea tráfico, revisar primero el target del CNAME `*` en DNS antes de tocar configuración del túnel o de Traefik.
