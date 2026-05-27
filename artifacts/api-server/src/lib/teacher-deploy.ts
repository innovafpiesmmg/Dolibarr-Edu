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
  disableCsrfInConfPhp,
  type ContainerState,
  type ContainerInfo,
} from "./docker";
import {
  ensureStudentDatabase,
  relaxStudentSecurityForSso,
  dropStudentDatabase,
  enableModulesInStudentDb,
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
} from "./teacher-dolibarr";
import { writeTeacherRoute, removeTeacherRoute } from "./traefik-config";
import {
  readDeployEnv,
  canOrchestrate,
  DEFAULT_DOLIBARR_MODULES,
  DEFAULT_DOLIBARR_MODULE_CONSTANTS,
  type DeployContext,
} from "./student-deploy";

// Re-exportar para que las rutas no tengan que importar de student-deploy.
export { readDeployEnv, canOrchestrate, type DeployContext };

export interface TeacherDeployRecord {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  dolibarrPassword: string | null;
}

export interface TeacherDeployResult {
  containerName: string;
  hostname: string;
  publicUrl: string;
  adminPassword: string;
  state: ContainerState;
}

export async function deployTeacherDolibarr(
  teacher: TeacherDeployRecord,
  ctx: DeployContext,
): Promise<TeacherDeployResult> {
  const gate = canOrchestrate();
  if (!gate.ok) throw new Error(gate.reason!);
  if (!ctx.baseDomain) throw new Error("Falta el dominio base. Configúralo en Configuración → Dominio base.");

  const username = teacher.username;
  const cName = containerName(username);
  const hostname = publicHostname(username, ctx.baseDomain);
  const adminPassword = teacher.dolibarrPassword ?? deterministicPassword(username);

  logger.info({ username, container: cName, hostname }, "Iniciando despliegue Dolibarr de profesor");

  await ensureStudentDatabase(dbName(username), dbUser(username), adminPassword);

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
      adminEmail: teacher.email,
      publicUrl: publicUrl(username, ctx.baseDomain),
      companyName: `${teacher.firstName} ${teacher.lastName} — Profesor`,
      countryCode: "64",
      language: "es_ES",
      image: ctx.image,
      modules: ctx.modules ?? DEFAULT_DOLIBARR_MODULES.join(","),
    });
    containerCreated = true;

    await waitForHttpHealthy(internalUrl(username), 180_000);

    await enableModulesInStudentDb(dbName(username), DEFAULT_DOLIBARR_MODULE_CONSTANTS).catch((e) =>
      logger.warn({ err: e, username }, "No se pudo activar módulos por SQL (continuando)"),
    );

    await relaxStudentSecurityForSso(dbName(username)).catch((e) =>
      logger.warn({ err: e, username }, "No se pudo desactivar CSRF en BD (continuando)"),
    );
    await disableCsrfInConfPhp(cName).catch((e) =>
      logger.warn({ err: e, username }, "No se pudo desactivar CSRF en conf.php (continuando)"),
    );
  } catch (err) {
    logger.error({ err, username, containerCreated }, "Deploy Dolibarr profesor fallido — compensando");
    if (!containerCreated) {
      await dropStudentDatabase(dbName(username), dbUser(username)).catch((e) =>
        logger.warn({ err: e, username }, "No se pudo dropear BD durante compensación"),
      );
    }
    invalidateTokenCache(username);
    throw err;
  }

  const state = await getContainerState(cName);

  await writeTeacherRoute(username, ctx.baseDomain).catch((err) =>
    logger.warn({ err, username }, "No se pudo escribir ruta Traefik profesor (continuando)"),
  );

  logger.info({ username, state }, "Dolibarr profesor desplegado");

  return {
    containerName: cName,
    hostname,
    publicUrl: publicUrl(username, ctx.baseDomain),
    adminPassword,
    state,
  };
}

export async function destroyTeacherDolibarr(username: string): Promise<void> {
  const safe = sanitize(username);
  if (!safe) throw new Error("username inválido");
  // Mismo patrón que destroyStudentDolibarr: propagamos errores de Docker/Mariadb,
  // pero garantizamos siempre la limpieza de la ruta Traefik (en finally) para no
  // dejar el subdominio público apuntando a un contenedor que ya no existe.
  try {
    if (isDockerAvailable()) {
      await removeContainer(containerName(username));
    }
    if (isMariaDBConfigured()) {
      await dropStudentDatabase(dbName(username), dbUser(username));
    }
  } finally {
    await removeTeacherRoute(username).catch((err) =>
      logger.warn({ err, username }, "No se pudo eliminar ruta Traefik profesor"),
    );
    invalidateTokenCache(username);
  }
}

export async function startTeacherContainer(username: string): Promise<ContainerInfo> {
  await startContainer(containerName(username));
  invalidateTokenCache(username);
  return getContainerInfo(containerName(username));
}

export async function stopTeacherContainer(username: string): Promise<ContainerInfo> {
  await stopContainer(containerName(username));
  invalidateTokenCache(username);
  return getContainerInfo(containerName(username));
}

export async function getTeacherContainerInfo(username: string): Promise<ContainerInfo> {
  return getContainerInfo(containerName(username));
}

export async function enableTeacherModules(username: string): Promise<{ enabled: string[] }> {
  const safe = sanitize(username);
  if (!safe) throw new Error("username inválido");
  if (!isMariaDBConfigured()) {
    throw new Error("MariaDB no configurada — no se puede activar módulos.");
  }
  await enableModulesInStudentDb(dbName(username), DEFAULT_DOLIBARR_MODULE_CONSTANTS);
  await relaxStudentSecurityForSso(dbName(username));
  await disableCsrfInConfPhp(containerName(username)).catch((e) =>
    logger.warn({ err: e, username }, "No se pudo desactivar CSRF en conf.php"),
  );
  return { enabled: [...DEFAULT_DOLIBARR_MODULE_CONSTANTS] };
}
