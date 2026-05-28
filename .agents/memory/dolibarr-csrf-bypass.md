---
name: Dolibarr CSRF bypass para SSO desde el panel
description: Cómo desactivar CSRFCHECK_WITH_TOKEN en cada contenedor Dolibarr de alumno/profesor para permitir autosubmit POST de login desde la landing. Qué NO funciona, qué sí, y por qué hace falta backup+rollback.
---

# Bypass CSRF en Dolibarr para autologin desde el panel

## El problema
La landing del panel envía un POST a `https://<usuario>.<baseDomain>/index.php`
con `actionlogin=login&username=X&password=Y`. Dolibarr lo rechaza con:

> Access to a page that needs a token (constant CSRFCHECK_WITH_TOKEN is defined)
> is refused by CSRF protection in main.inc.php. Token not provided.

La comprobación está dentro de `main.inc.php` y se dispara porque `index.php`
hace `define('CSRFCHECK_WITH_TOKEN', 1)` antes de `require main.inc.php`.

Solo se bypasa si `NOCSRFCHECK` está definido **antes** de ese check.

**Why:** Es un POST cross-origin con cuerpo `password=`, exactamente el caso
que la CSRF de Dolibarr está diseñada para bloquear. No hay configuración
oficial soportada para desactivarlo.

## Qué NO funciona

- `$dolibarr_nocsrfcheck = 1;` en `conf.php` → solo bypassea la rama
  `MAIN_SECURITY_CSRF_WITH_TOKEN`, NO la rama `defined('CSRFCHECK_WITH_TOKEN')`.
- `define('NOCSRFCHECK', 1)` dentro de `conf.php` → llega tarde, conf.php se
  carga DESDE main.inc.php cuando ya pasó el check.
- `auto_prepend_file` en `/usr/local/etc/php/conf.d/*.ini` → la imagen de
  Dolibarr no usa el layout `php:apache` estándar; esa ruta es ignorada.
  (Probado en mayo 2026 — silently no-op, sin error visible).

## Qué SÍ funciona

Parchear directamente `/var/www/html/main.inc.php` inyectando una línea
después del `<?php` de apertura:

```php
<?php
if (!defined("NOCSRFCHECK")) { define("NOCSRFCHECK", 1); } /* DOLIBARR_EDU_NOCSRF_PATCH */
... resto original ...
```

**How to apply:** se ejecuta como parte de `disableCsrfInConfPhp()` en
`artifacts/api-server/src/lib/docker.ts`, llamado tras cada deploy y por
`autoHealCsrf` al loguearse el alumno.

## NUNCA usar `mv` desde `/tmp` — destroza permisos

Síntoma: tras patchear, Dolibarr devuelve 500 GENERALIZADO con este error en
`/var/log/apache2/error.log` dentro del contenedor:

```
PHP Warning: require(/var/www/html/main.inc.php): Failed to open stream:
Permission denied in /var/www/html/index.php on line 33
```

Causa: `mktemp` crea `/tmp/tmp.XXX` con `0600 root:root` (porque `docker exec`
corre como root). `mv "$TMP" /var/www/html/main.inc.php` **arrastra esos
perms al destino** → Apache, que corre como `www-data`, no puede leerlo.

**Usar `cp` en su lugar** (preserva inode del destino → preserva owner+mode),
y aun así capturar owner+mode con `stat` antes de tocar y restaurarlos al
final con `chown`/`chmod` como cinturón y tirantes. La verificación final
debe incluir un `su -s /bin/sh www-data -c "cat main.inc.php > /dev/null"`
para detectar el problema ANTES de devolver "applied".

Recuperación manual del contenedor afectado:
```bash
docker exec dolibarr_alu_USUARIO sh -c '
  chown www-data:www-data /var/www/html/main.inc.php
  chmod 644 /var/www/html/main.inc.php
  apache2ctl graceful 2>/dev/null || kill -USR1 1
'
```

## REGLA DE ORO — backup + lint + rollback

Tocar `main.inc.php` mal deja a **toda** la app Dolibarr con HTTP 500 (no solo
el endpoint de login; también `/login.php` y todo lo demás). En mayo 2026
pasó dos veces: una con `sed -i "1a\\\\..."` y comillas dobles dentro
rompiendo el quoting del shell; otra por causa no identificada que dejó
main.inc.php con error de parseo.

El patch DEBE:
1. Cortar al detectar `marker` ya presente (idempotente).
2. Hacer `cp ${mainIncPath} ${mainIncPath}.dolibarr-edu-bak` **antes** de tocar
   (no sobrescribir si ya existe — el primer backup es el "bueno"; backups
   posteriores podrían ser de versiones ya rotas).
3. Construir la versión parcheada en `$(mktemp)`, nunca in-place.
4. Lintar el TMP con `php -l` antes de copiar a destino.
5. Tras copiar: re-lintar el destino y verificar que el marker está en las
   primeras 3 líneas. Si cualquiera falla, `cp $backup $main` y `exit 1`.
6. El catch del lado Node debe llamar a un segundo exec que restaure el
   backup ante CUALQUIER excepción.
7. `apache2ctl graceful` (con fallback a `kill -USR1 1`) tras aplicar — sin
   eso, opcache puede servir la versión vieja cacheada.

## Quoting

- `head -n 1` + `cat <<'EOF'` (delimitador entre comillas simples) +
  `tail -n +2`. **No usar sed** con comillas dobles en el cuerpo: si el cuerpo
  PHP tiene `"`, rompe el quoting del shell envolvente.

## Recovery manual en producción

Si un contenedor está roto con 500 tras un patch fallido, desde el host:

```bash
docker exec dolibarr_alu_USUARIO sh -c '
  if [ -f /var/www/html/main.inc.php.dolibarr-edu-bak ]; then
    cp /var/www/html/main.inc.php.dolibarr-edu-bak /var/www/html/main.inc.php
    apache2ctl graceful 2>/dev/null || kill -USR1 1
    echo restored
  else
    sed -i "/DOLIBARR_EDU_NOCSRF_PATCH/d" /var/www/html/main.inc.php
    echo patch-line-removed
  fi
'
```

## Form de autosubmit (landing)

POST a `<dolibarrUrl>/index.php` con:
- `actionlogin=login`
- `loginfunction=loginfunction`
- `entity=1`
- `username` + `password`

Funciona con la credencial del panel (el alumno/profe entra a Dolibarr con
su username del panel, no `admin`). Para que coincidan: `dolibarrPassword`
en la BD se guarda en plaintext al crear/resetear, y `adminLogin =
student.username` en el deploy del contenedor. Cambiar admin solo aplica
en el primer install (DOLI_ADMIN_LOGIN/PASSWORD); contenedores ya creados
con `admin` requieren destroy+deploy para migrar al modelo nuevo.
