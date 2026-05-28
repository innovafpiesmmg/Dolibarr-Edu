import { existsSync } from "fs";
import Docker from "dockerode";
import { logger } from "./logger";

const SOCKET_PATH = process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";

let cachedClient: Docker | null = null;

export function isDockerAvailable(): boolean {
  try {
    return existsSync(SOCKET_PATH);
  } catch {
    return false;
  }
}

function client(): Docker {
  if (!cachedClient) {
    cachedClient = new Docker({ socketPath: SOCKET_PATH });
  }
  return cachedClient;
}

export type ContainerState = "absent" | "created" | "running" | "exited" | "paused" | "restarting" | "removing" | "dead";

export interface ContainerInfo {
  exists: boolean;
  state: ContainerState;
  startedAt: string | null;
}

export async function getContainerState(name: string): Promise<ContainerState> {
  const info = await getContainerInfo(name);
  return info.state;
}

export async function getContainerInfo(name: string): Promise<ContainerInfo> {
  if (!isDockerAvailable()) return { exists: false, state: "absent", startedAt: null };
  try {
    const info = await client().getContainer(name).inspect();
    const state = (info.State.Status as ContainerState) ?? "absent";
    const startedAt = info.State.StartedAt && info.State.StartedAt !== "0001-01-01T00:00:00Z"
      ? info.State.StartedAt
      : null;
    return { exists: true, state, startedAt };
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return { exists: false, state: "absent", startedAt: null };
    throw err;
  }
}

export interface StudentContainerSpec {
  containerName: string;
  hostname: string;
  network: string;
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  adminLogin: string;
  adminPassword: string;
  adminEmail: string;
  publicUrl: string;
  companyName: string;
  countryCode: string;
  language: string;
  image: string;
  modules: string;
}

function traefikLabels(name: string, hostname: string): Record<string, string> {
  const router = `dolibarr-${name}`;
  return {
    "traefik.enable": "true",
    [`traefik.http.routers.${router}.rule`]: `Host(\`${hostname}\`)`,
    [`traefik.http.routers.${router}.entrypoints`]: "web",
    [`traefik.http.services.${router}.loadbalancer.server.port`]: "80",
    "edu.dolibarr.kind": "student-dolibarr",
    "edu.dolibarr.container": name,
  };
}

export async function ensureStudentContainer(spec: StudentContainerSpec): Promise<void> {
  if (!isDockerAvailable()) {
    throw new Error("Docker no disponible. Esta operación solo funciona en el servidor del centro.");
  }
  const docker = client();
  const state = await getContainerState(spec.containerName);

  if (state === "running") return;
  if (state !== "absent") {
    // Existe pero parado — arrancar
    await docker.getContainer(spec.containerName).start();
    return;
  }

  // Asegurar imagen disponible (pull si no existe)
  await new Promise<void>((resolve, reject) => {
    docker.pull(spec.image, (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
      if (err) return reject(err);
      if (!stream) return resolve();
      docker.modem.followProgress(stream, (e: Error | null) => (e ? reject(e) : resolve()));
    });
  }).catch((err) => {
    logger.warn({ err, image: spec.image }, "No se pudo hacer pull (puede que ya esté cacheada)");
  });

  const container = await docker.createContainer({
    name: spec.containerName,
    Image: spec.image,
    Hostname: spec.hostname.split(".")[0],
    Env: [
      `DOLI_DB_HOST=${spec.dbHost}`,
      `DOLI_DB_PORT=3306`,
      `DOLI_DB_USER=${spec.dbUser}`,
      `DOLI_DB_PASSWORD=${spec.dbPassword}`,
      `DOLI_DB_NAME=${spec.dbName}`,
      `DOLI_URL_ROOT=${spec.publicUrl}`,
      `DOLI_ADMIN_LOGIN=${spec.adminLogin}`,
      `DOLI_ADMIN_PASSWORD=${spec.adminPassword}`,
      `DOLI_ADMIN_EMAIL=${spec.adminEmail}`,
      `DOLI_COMPANY_NAME=${spec.companyName}`,
      `DOLI_COMPANY_COUNTRY_ID=${spec.countryCode}`,
      `DOLI_MODULES=${spec.modules}`,
      `DOLI_AUTH=dolibarr`,
      `DOLI_HTTPS=0`,
      `PHP_INI_DATE_TIMEZONE=Europe/Madrid`,
    ],
    Labels: traefikLabels(spec.containerName, spec.hostname),
    HostConfig: {
      RestartPolicy: { Name: "unless-stopped" },
      NetworkMode: spec.network,
    },
  });

  await container.start();
  logger.info({ container: spec.containerName }, "Contenedor Dolibarr creado y arrancado");
}

export async function startContainer(name: string): Promise<void> {
  if (!isDockerAvailable()) throw new Error("Docker no disponible");
  await client().getContainer(name).start().catch((err: { statusCode?: number }) => {
    if (err.statusCode === 304) return; // ya arrancado
    throw err;
  });
}

export async function stopContainer(name: string): Promise<void> {
  if (!isDockerAvailable()) throw new Error("Docker no disponible");
  await client().getContainer(name).stop({ t: 10 }).catch((err: { statusCode?: number }) => {
    if (err.statusCode === 304 || err.statusCode === 404) return; // ya parado o no existe
    throw err;
  });
}

export async function removeContainer(name: string): Promise<void> {
  if (!isDockerAvailable()) throw new Error("Docker no disponible");
  const c = client().getContainer(name);
  try { await c.stop({ t: 5 }); } catch { /* ya parado o no existe */ }
  try { await c.remove({ force: true, v: true }); } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode !== 404) throw err;
  }
  logger.info({ container: name }, "Contenedor eliminado");
}

// Ejecuta un comando dentro del contenedor y devuelve stdout+stderr concatenados.
// Lanza si el exit code != 0.
export async function execInContainer(
  name: string,
  cmd: string[],
): Promise<string> {
  if (!isDockerAvailable()) throw new Error("Docker no disponible");
  const container = client().getContainer(name);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    User: "root",
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  const inspect = await exec.inspect();
  const out = Buffer.concat(chunks).toString("utf8");
  if (inspect.ExitCode && inspect.ExitCode !== 0) {
    throw new Error(`exec ${cmd.join(" ")} salió con código ${inspect.ExitCode}: ${out}`);
  }
  return out;
}

// Añade `$dolibarr_nocsrfcheck = 1;` al conf.php del contenedor del alumno si
// aún no está presente. Esto desactiva globalmente la comprobación de token
// CSRF (incluyendo páginas que la fuerzan con `define('CSRFCHECK_WITH_TOKEN')`),
// necesario para nuestro flujo SSO autosubmit desde el panel.
//
// Es seguro porque cada contenedor Dolibarr es de un único alumno, no se
// exponen formularios públicos y el acceso siempre pasa por la autenticación
// del panel. Idempotente: comprueba si la línea ya existe antes de añadirla.
export async function disableCsrfInConfPhp(containerName: string): Promise<void> {
  const confPath = "/var/www/html/conf/conf.php";
  // Aplicamos DOS overrides porque distintas versiones de Dolibarr respetan uno
  // u otro:
  //
  //  - `$dolibarr_nocsrfcheck = 1;` — bypassa la rama `MAIN_SECURITY_CSRF_WITH_TOKEN`
  //    pero NO la rama `defined('CSRFCHECK_WITH_TOKEN')`.
  //  - `define('NOCSRFCHECK', 1);` — bypassa AMBAS ramas, incluida la que
  //    fuerzan ciertas páginas con `define('CSRFCHECK_WITH_TOKEN','1')` al
  //    inicio (que es exactamente el error que ve el alumno haciendo SSO desde
  //    el panel: "constant CSRFCHECK_WITH_TOKEN is defined ... Token not provided").
  //
  // Es seguro porque cada contenedor Dolibarr es del único alumno/profesor
  // dueño, no expone formularios públicos y todo acceso pasa por nuestra
  // autenticación previa en el panel. Idempotente.
  // OJO con las comillas: queremos que PHP reciba comillas dobles REALES, no
  // barras invertidas. Usamos here-doc + comillas simples en el delimitador
  // para que el shell no interprete nada del cuerpo.
  // Antes de añadir, limpiamos:
  //   - duplicados previos (rondas de auto-heal anteriores).
  //   - la versión "rota" con \" literales (`if (!defined(\"NOCSRFCHECK...`)
  //     que produjo el bug y deja a Dolibarr con HTTP 500 (parse error PHP).
  // El error real es:
  //   "Access to a page that needs a token (constant CSRFCHECK_WITH_TOKEN is
  //    defined) is refused by CSRF protection in main.inc.php"
  //
  // La comprobación está DENTRO de main.inc.php. CSRFCHECK_WITH_TOKEN se define
  // en cabecera de los index.php que aceptan POST antes de hacer `require
  // main.inc.php`. Para bypasarlo, NOCSRFCHECK tiene que estar definido ANTES
  // de que ese bloque corra.
  //
  // Probamos antes con `auto_prepend_file` en una ini de PHP, pero la imagen
  // de Dolibarr no respeta esa ruta (no usa el layout de `php:apache`
  // estándar). La forma garantizada es parchear `main.inc.php` directamente
  // insertando la define justo después del `<?php` de apertura.
  //
  // Es seguro: cada contenedor Dolibarr pertenece a un único usuario, no se
  // expone formulario público y todo acceso pasa por la auth previa del panel.
  // Idempotente: comprueba si ya fue parcheado antes de tocar nada.
  const mainIncPath = "/var/www/html/main.inc.php";
  const backupPath = `${mainIncPath}.dolibarr-edu-bak`;
  // v2: añade renombrado de CSRFCHECK_WITH_TOKEN. Bumpear cada vez que cambie
  // el contenido del patch para que contenedores ya parcheados se re-parcheen.
  const marker = "DOLIBARR_EDU_NOCSRF_PATCH_V2";
  // REGLA DE ORO: NUNCA tocar main.inc.php sin backup + lint + rollback.
  // Cualquier fallo deja un 500 generalizado en Dolibarr (también afecta a
  // /login.php, no sólo al SSO). Si php -l falla tras patchear, restauramos.
  const sh =
    `set -e; ` +
    // 1) conf.php: $dolibarr_nocsrfcheck=1 (cubre rama MAIN_SECURITY_CSRF_WITH_TOKEN).
    `if [ -f ${confPath} ]; then ` +
    `  sed -i '/dolibarr_nocsrfcheck/d; /NOCSRFCHECK/d' ${confPath}; ` +
    `  echo '$dolibarr_nocsrfcheck = 1;' >> ${confPath}; ` +
    `fi; ` +
    `if [ ! -f ${mainIncPath} ]; then echo no-main; exit 0; fi; ` +
    // 2) Si ya está parcheado, salir.
    `if grep -q ${marker} ${mainIncPath}; then echo already-patched-main; exit 0; fi; ` +
    // 3) Backup ANTES de tocar nada. Si ya existe un backup previo, no lo
    //    sobreescribimos para no perder el original tras patches sucesivos
    //    fallidos.
    `if [ ! -f ${backupPath} ]; then cp ${mainIncPath} ${backupPath}; fi; ` +
    // 3b) Capturar owner y modo del original ANTES de tocar. Si por lo que sea
    //     el patch nuke los permisos (ej. usar 'mv' desde /tmp que arrastra
    //     root:root 0600), restauramos al final. Sin esto, Apache (www-data)
    //     no podrá leer main.inc.php y Dolibarr devolverá 500 en TODO.
    `ORIG_OWNER=$(stat -c '%u:%g' ${mainIncPath}); ` +
    `ORIG_MODE=$(stat -c '%a' ${mainIncPath}); ` +
    // 4) Construir versión parcheada en /tmp.
    //    a) Inyectar NOCSRFCHECK al principio (desactiva el check estándar).
    //    b) Renombrar la constante 'CSRFCHECK_WITH_TOKEN' por una que NUNCA
    //       está definida ('DOLIBARR_EDU_DISABLED_CSRF'), así todas las ramas
    //       `defined('CSRFCHECK_WITH_TOKEN')` de main.inc.php se evalúan a
    //       false y se salta el bloque entero "Token not provided". NOCSRFCHECK
    //       NO desactiva esta segunda rama — son dos checks independientes.
    `TMP=$(mktemp); ` +
    `head -n 1 ${mainIncPath} > "$TMP"; ` +
    `cat >> "$TMP" <<'EOF_NOCSRF_PATCH'\n` +
    `if (!defined("NOCSRFCHECK")) { define("NOCSRFCHECK", 1); } /* ${marker} */\n` +
    `EOF_NOCSRF_PATCH\n` +
    `tail -n +2 ${mainIncPath} >> "$TMP"; ` +
    `sed -i "s/defined('CSRFCHECK_WITH_TOKEN')/defined('DOLIBARR_EDU_DISABLED_CSRF')/g" "$TMP"; ` +
    `sed -i 's/defined("CSRFCHECK_WITH_TOKEN")/defined("DOLIBARR_EDU_DISABLED_CSRF")/g' "$TMP"; ` +
    // 5) Lint en el fichero temporal — si falla, NO sobreescribimos el original.
    `if ! php -l "$TMP" > /tmp/lint.out 2>&1; then ` +
    `  echo "LINT_FAIL:"; cat /tmp/lint.out; rm -f "$TMP"; exit 1; ` +
    `fi; ` +
    // 6) Lint pasó: aplicamos con 'cp' (preserva inode → preserva perms),
    //    y por si acaso forzamos owner+mode originales.
    `cp "$TMP" ${mainIncPath}; rm -f "$TMP"; ` +
    `chown "$ORIG_OWNER" ${mainIncPath} 2>/dev/null || chown www-data:www-data ${mainIncPath} || true; ` +
    `chmod "$ORIG_MODE" ${mainIncPath} 2>/dev/null || chmod 644 ${mainIncPath} || true; ` +
    // 7) Verificación final: marker en las primeras 3 líneas + sintaxis del fichero ya in-place + lecturable por www-data.
    `head -n 3 ${mainIncPath} | grep -q ${marker} || { echo "MARKER_MISSING"; cp ${backupPath} ${mainIncPath}; chown "$ORIG_OWNER" ${mainIncPath} 2>/dev/null; chmod "$ORIG_MODE" ${mainIncPath} 2>/dev/null; exit 1; }; ` +
    `php -l ${mainIncPath} > /dev/null || { echo "POST_LINT_FAIL"; cp ${backupPath} ${mainIncPath}; chown "$ORIG_OWNER" ${mainIncPath} 2>/dev/null; chmod "$ORIG_MODE" ${mainIncPath} 2>/dev/null; exit 1; }; ` +
    `su -s /bin/sh www-data -c "cat ${mainIncPath} > /dev/null" 2>/dev/null || { echo "WWW_DATA_CANT_READ"; chmod 644 ${mainIncPath}; chown www-data:www-data ${mainIncPath}; }; ` +
    // 8) Recarga Apache.
    `(apache2ctl graceful 2>/dev/null || /usr/sbin/apache2ctl graceful 2>/dev/null || kill -USR1 1 2>/dev/null) || true; ` +
    `echo applied`;
  try {
    const out = await execInContainer(containerName, ["sh", "-c", sh]);
    logger.info({ containerName, result: out.trim() }, "CSRF parche aplicado a main.inc.php");
  } catch (err) {
    // Si por lo que sea petó, intenta restaurar el backup automáticamente.
    logger.warn({ containerName, err: String(err) }, "Patch de CSRF falló — intentando restaurar backup");
    try {
      const restore = await execInContainer(containerName, ["sh", "-c",
        `if [ -f ${backupPath} ]; then cp ${backupPath} ${mainIncPath}; ` +
        `(apache2ctl graceful 2>/dev/null || kill -USR1 1) || true; echo restored; ` +
        `else echo no-backup; fi`,
      ]);
      logger.info({ containerName, result: restore.trim() }, "Backup restaurado");
    } catch (restoreErr) {
      logger.error({ containerName, restoreErr: String(restoreErr) }, "No se pudo restaurar el backup");
    }
  }
}

export async function waitForHttpHealthy(internalUrl: string, timeoutMs = 180_000): Promise<void> {
  const start = Date.now();
  const url = internalUrl.replace(/\/$/, "");
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status === 302 || res.status === 303) return;
    } catch {
      // ignore, retry
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Dolibarr no respondió en ${timeoutMs / 1000}s en ${internalUrl}`);
}
