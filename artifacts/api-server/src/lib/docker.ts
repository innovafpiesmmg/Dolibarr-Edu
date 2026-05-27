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
  const sh =
    `set -e; ` +
    `if [ ! -f ${confPath} ]; then echo no-conf; exit 0; fi; ` +
    // Borra cualquier línea con la patata mala o duplicados nuestros previos.
    `sed -i '/dolibarr_nocsrfcheck/d; /NOCSRFCHECK/d' ${confPath}; ` +
    // Añade las dos directivas, una sola vez, con comillas dobles reales.
    `cat >> ${confPath} <<'EOF_DOLIBARR_CSRF'\n` +
    `$dolibarr_nocsrfcheck = 1;\n` +
    `if (!defined("NOCSRFCHECK")) { define("NOCSRFCHECK", 1); }\n` +
    `EOF_DOLIBARR_CSRF\n` +
    `echo applied`;
  const out = await execInContainer(containerName, ["sh", "-c", sh]);
  logger.info({ containerName, result: out.trim() }, "CSRF desactivado en conf.php");
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
