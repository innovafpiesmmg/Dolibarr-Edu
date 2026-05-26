import { logger } from "./logger";
import {
  ensureStudentContainer,
  getContainerState,
  getContainerInfo,
  removeContainer,
  waitForHttpHealthy,
  startContainer,
  stopContainer,
  isDockerAvailable,
  type ContainerState,
  type ContainerInfo,
} from "./docker";
import {
  ensureStudentDatabase,
  dropStudentDatabase,
  isMariaDBConfigured,
} from "./mariadb";
import {
  containerName,
  dbName,
  dbUser,
  deterministicPassword,
  publicHostname,
  publicUrl,
  internalUrl,
  invalidateTokenCache,
  sanitize,
} from "./student-dolibarr";
import { writeStudentRoute, removeStudentRoute } from "./traefik-config";

export interface DeployContext {
  baseDomain: string;
  network: string;
  mariadbHost: string;
  image: string;
  modules: string;
}

export function readDeployEnv(baseDomain: string): DeployContext {
  return {
    baseDomain,
    network: process.env.STUDENT_DOCKER_NETWORK ?? "dolibarr_net",
    mariadbHost: process.env.MARIADB_HOST ?? "db",
    image: process.env.DOLIBARR_IMAGE ?? "dolibarr/dolibarr:latest",
    modules: process.env.DOLIBARR_MODULES
      ?? "modApi,modSociete,modFournisseur,modFacture,modProjet,modStock,modBanque,modContrat,modComptabilite,modHrm,modSalaries",
  };
}

export interface StudentDeployRecord {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  dolibarrPassword: string | null;
}

export interface DeployResult {
  containerName: string;
  hostname: string;
  publicUrl: string;
  adminPassword: string;
  state: ContainerState;
}

export function canOrchestrate(): { ok: boolean; reason?: string } {
  if (!isDockerAvailable()) {
    return { ok: false, reason: "Docker no disponible (¿estás en el servidor del centro?). Comprueba que /var/run/docker.sock esté montado en panel_api." };
  }
  if (!isMariaDBConfigured()) {
    return { ok: false, reason: "MariaDB no configurada. Faltan variables MARIADB_HOST / MARIADB_ROOT_PASSWORD en panel_api." };
  }
  return { ok: true };
}

export async function deployStudentDolibarr(
  student: StudentDeployRecord,
  ctx: DeployContext,
): Promise<DeployResult> {
  const gate = canOrchestrate();
  if (!gate.ok) throw new Error(gate.reason!);
  if (!ctx.baseDomain) throw new Error("Falta el dominio base. Configúralo en Configuración → Dominio base.");

  const username = student.username;
  const cName = containerName(username);
  const hostname = publicHostname(username, ctx.baseDomain);
  const adminPassword = student.dolibarrPassword ?? deterministicPassword(username);

  logger.info({ username, container: cName, hostname }, "Iniciando despliegue Dolibarr de alumno");

  // 1) BD del alumno
  await ensureStudentDatabase(dbName(username), dbUser(username), adminPassword);

  // 2) Contenedor del alumno (con compensación si algo falla después)
  let containerCreated = false;
  try {
    await ensureStudentContainer({
      containerName: cName,
      hostname,
      network: ctx.network,
      dbHost: ctx.mariadbHost,
      dbName: dbName(username),
      dbUser: dbUser(username),
      dbPassword: adminPassword,
      adminLogin: "admin",
      adminPassword,
      adminEmail: student.email,
      publicUrl: publicUrl(username, ctx.baseDomain),
      companyName: student.companyName ?? `Empresa de ${student.firstName} ${student.lastName}`,
      countryCode: "64",
      language: "es_ES",
      image: ctx.image,
      modules: ctx.modules,
    });
    containerCreated = true;

    // 3) Esperar a que Dolibarr arranque y termine la instalación inicial
    await waitForHttpHealthy(internalUrl(username), 180_000);
  } catch (err) {
    // Compensación: si el contenedor se creó pero el health-check falló, lo
    // dejamos *parado* (no destruimos) para diagnóstico, pero invalidamos token.
    // Si ni siquiera se creó, dropeamos la BD para no dejar huérfana.
    logger.error({ err, username, containerCreated }, "Deploy Dolibarr fallido — compensando");
    if (!containerCreated) {
      await dropStudentDatabase(dbName(username), dbUser(username)).catch((e) =>
        logger.warn({ err: e, username }, "No se pudo dropear BD durante compensación"),
      );
    }
    invalidateTokenCache(username);
    throw err;
  }

  const state = await getContainerState(cName);

  // 4) Publicar ruta Traefik (file provider) — Traefik la detecta en caliente
  await writeStudentRoute(username, ctx.baseDomain).catch((err) =>
    logger.warn({ err, username }, "No se pudo escribir ruta Traefik (continuando)"),
  );

  logger.info({ username, state }, "Dolibarr de alumno desplegado");

  return {
    containerName: cName,
    hostname,
    publicUrl: publicUrl(username, ctx.baseDomain),
    adminPassword,
    state,
  };
}

export async function destroyStudentDolibarr(username: string): Promise<void> {
  const safe = sanitize(username);
  if (!safe) throw new Error("username inválido");
  if (isDockerAvailable()) {
    await removeContainer(containerName(username));
  }
  if (isMariaDBConfigured()) {
    await dropStudentDatabase(dbName(username), dbUser(username));
  }
  await removeStudentRoute(username).catch((err) =>
    logger.warn({ err, username }, "No se pudo eliminar ruta Traefik"),
  );
  invalidateTokenCache(username);
}

export async function startStudentContainer(username: string): Promise<ContainerInfo> {
  await startContainer(containerName(username));
  invalidateTokenCache(username);
  return getContainerInfo(containerName(username));
}

export async function stopStudentContainer(username: string): Promise<ContainerInfo> {
  await stopContainer(containerName(username));
  invalidateTokenCache(username);
  return getContainerInfo(containerName(username));
}

export async function getStudentContainerInfo(username: string): Promise<ContainerInfo> {
  return getContainerInfo(containerName(username));
}
