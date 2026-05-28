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
  teamContainerName,
  teamDbName,
  teamDbUser,
  teamInternalUrl,
  publicHostname,
  publicUrl,
  invalidateTeamTokenCache,
} from "./team-dolibarr";
import { writeTeamRoute, removeTeamRoute } from "./traefik-config";
import {
  readDeployEnv,
  canOrchestrate,
  DEFAULT_DOLIBARR_MODULE_CONSTANTS,
  type DeployContext,
} from "./student-deploy";

export { readDeployEnv, canOrchestrate };

export interface TeamDeployRecord {
  groupSlug: string;
  letter: string;
  teamName: string;
  groupName: string;
  teacherUsername: string;
  teacherPassword: string | null;
  teacherEmail: string;
}

export interface TeamDeployResult {
  containerName: string;
  hostname: string;
  publicUrl: string;
  state: ContainerState;
}

export async function deployTeamDolibarr(
  team: TeamDeployRecord,
  ctx: DeployContext,
): Promise<TeamDeployResult> {
  const gate = canOrchestrate();
  if (!gate.ok) throw new Error(gate.reason!);
  if (!ctx.baseDomain) {
    throw new Error("Falta el dominio base. Configúralo en Configuración → Dominio base.");
  }
  if (!team.teacherPassword) {
    throw new Error(
      `Profesor ${team.teacherUsername} sin dolibarrPassword: despliega su Dolibarr individual antes (sus credenciales se reutilizan como admin del Dolibarr del equipo).`,
    );
  }

  const cName = teamContainerName(team.groupSlug, team.letter);
  const dName = teamDbName(team.groupSlug, team.letter);
  const dUser = teamDbUser(team.groupSlug, team.letter);
  const hostname = publicHostname(team.groupSlug, team.letter, ctx.baseDomain);
  const adminLogin = team.teacherUsername;
  const adminPassword = team.teacherPassword;

  logger.info(
    { team: `${team.letter}/${team.groupSlug}`, container: cName, hostname },
    "Iniciando despliegue Dolibarr de equipo",
  );

  // 1) BD del equipo (BD propia, password = la del profe para consistencia
  //    en ese contenedor — no se expone fuera del network Docker interno).
  await ensureStudentDatabase(dName, dUser, adminPassword);

  // 2) Contenedor del equipo
  let containerCreated = false;
  try {
    await ensureStudentContainer({
      containerName: cName,
      hostname,
      network: ctx.network,
      dbHost: ctx.mariadbHost,
      dbName: dName,
      dbUser: dUser,
      dbPassword: adminPassword,
      adminLogin,
      adminPassword,
      adminEmail: team.teacherEmail,
      publicUrl: publicUrl(team.groupSlug, team.letter, ctx.baseDomain),
      companyName: `${team.teamName} — ${team.groupName}`,
      countryCode: "64",
      language: "es_ES",
      image: ctx.image,
      modules: ctx.modules,
    });
    containerCreated = true;

    await waitForHttpHealthy(teamInternalUrl(team.groupSlug, team.letter), 180_000);

    await enableModulesInStudentDb(dName, DEFAULT_DOLIBARR_MODULE_CONSTANTS).catch((e) =>
      logger.warn({ err: e, team: `${team.letter}/${team.groupSlug}` }, "No se pudo activar módulos por SQL (continuando)"),
    );
    await relaxStudentSecurityForSso(dName).catch((e) =>
      logger.warn({ err: e, team: `${team.letter}/${team.groupSlug}` }, "No se pudo desactivar CSRF en BD (continuando)"),
    );
    await disableCsrfInConfPhp(cName).catch((e) =>
      logger.warn({ err: e, team: `${team.letter}/${team.groupSlug}` }, "No se pudo desactivar CSRF en conf.php (continuando)"),
    );
  } catch (err) {
    logger.error({ err, team: `${team.letter}/${team.groupSlug}`, containerCreated }, "Deploy Dolibarr equipo fallido — compensando");
    if (!containerCreated) {
      await dropStudentDatabase(dName, dUser).catch((e) =>
        logger.warn({ err: e, team: `${team.letter}/${team.groupSlug}` }, "No se pudo dropear BD durante compensación"),
      );
    }
    invalidateTeamTokenCache(team.groupSlug, team.letter);
    throw err;
  }

  const state = await getContainerState(cName);

  await writeTeamRoute(team.groupSlug, team.letter, ctx.baseDomain).catch((err) =>
    logger.warn({ err, team: `${team.letter}/${team.groupSlug}` }, "No se pudo escribir ruta Traefik equipo (continuando)"),
  );

  logger.info({ team: `${team.letter}/${team.groupSlug}`, state }, "Dolibarr de equipo desplegado");

  return {
    containerName: cName,
    hostname,
    publicUrl: publicUrl(team.groupSlug, team.letter, ctx.baseDomain),
    state,
  };
}

export async function destroyTeamDolibarr(groupSlug: string, letter: string): Promise<void> {
  const cName = teamContainerName(groupSlug, letter);
  const dName = teamDbName(groupSlug, letter);
  const dUser = teamDbUser(groupSlug, letter);
  if (isDockerAvailable()) {
    await removeContainer(cName);
  }
  if (isMariaDBConfigured()) {
    await dropStudentDatabase(dName, dUser);
  }
  await removeTeamRoute(groupSlug, letter).catch((err) =>
    logger.warn({ err, groupSlug, letter }, "No se pudo eliminar ruta Traefik equipo"),
  );
  invalidateTeamTokenCache(groupSlug, letter);
}

export async function startTeamContainer(groupSlug: string, letter: string): Promise<ContainerInfo> {
  const cName = teamContainerName(groupSlug, letter);
  await startContainer(cName);
  invalidateTeamTokenCache(groupSlug, letter);
  return getContainerInfo(cName);
}

export async function stopTeamContainer(groupSlug: string, letter: string): Promise<ContainerInfo> {
  const cName = teamContainerName(groupSlug, letter);
  await stopContainer(cName);
  invalidateTeamTokenCache(groupSlug, letter);
  return getContainerInfo(cName);
}

export async function restartTeamContainer(groupSlug: string, letter: string): Promise<ContainerInfo> {
  const cName = teamContainerName(groupSlug, letter);
  await stopContainer(cName).catch(() => undefined);
  await startContainer(cName);
  invalidateTeamTokenCache(groupSlug, letter);
  return getContainerInfo(cName);
}

export async function getTeamContainerInfo(groupSlug: string, letter: string): Promise<ContainerInfo> {
  return getContainerInfo(teamContainerName(groupSlug, letter));
}
