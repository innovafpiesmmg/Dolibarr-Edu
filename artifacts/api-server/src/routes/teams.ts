import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, teamsTable, groupsTable, studentsTable, teachersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";
import {
  nextLetter,
  groupNameToSlug,
  publicUrl as teamPublicUrl,
  teamContainerName,
  getTeamDolibarrConfig,
} from "../lib/team-dolibarr";
import { removeTeamRoute } from "../lib/traefik-config";
import { getBaseDomain } from "./settings";
import {
  startStudentContainer,
  stopStudentContainer,
} from "../lib/student-deploy";
import {
  deployTeamDolibarr,
  destroyTeamDolibarr,
  startTeamContainer,
  stopTeamContainer,
  restartTeamContainer,
  getTeamContainerInfo,
  readDeployEnv,
  canOrchestrate,
} from "../lib/team-deploy";
import { createDolibarrUser, deleteDolibarrUser, findDolibarrUserIdByLogin } from "../lib/dolibarr";
import type { ContainerInfo } from "../lib/docker";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    return code ? `[${code}] ${err.message}` : err.message;
  }
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { code?: string; errno?: number; sqlMessage?: string; message?: string; reason?: string };
    const parts = [e.code, e.sqlMessage, e.message, e.reason, e.errno != null ? `errno=${e.errno}` : null].filter(Boolean);
    if (parts.length) return parts.join(" — ");
    try { return JSON.stringify(err); } catch { /* noop */ }
  }
  return `Error desconocido (${String(err)})`;
}

function parseTeamId(idRaw: string): number | null {
  const id = Number(idRaw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function loadTeamFull(teamId: number) {
  const [row] = await db
    .select({
      teamId: teamsTable.id,
      letter: teamsTable.letter,
      name: teamsTable.name,
      groupId: teamsTable.groupId,
      groupName: groupsTable.name,
      teacherId: groupsTable.teacherId,
      teacherUsername: teachersTable.username,
      teacherEmail: teachersTable.email,
      teacherDolibarrPassword: teachersTable.dolibarrPassword,
      teacherSyncStatus: teachersTable.dolibarrSyncStatus,
      dolibarrSyncStatus: teamsTable.dolibarrSyncStatus,
      createdAt: teamsTable.createdAt,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .innerJoin(teachersTable, eq(teachersTable.id, groupsTable.teacherId))
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  return row ?? null;
}

async function listTeamRow(teamId: number) {
  const [row] = await db
    .select({
      id: teamsTable.id,
      groupId: teamsTable.groupId,
      groupName: groupsTable.name,
      letter: teamsTable.letter,
      name: teamsTable.name,
      dolibarrSyncStatus: teamsTable.dolibarrSyncStatus,
      dolibarrSyncError: teamsTable.dolibarrSyncError,
      memberCount: sql<number>`count(${studentsTable.id})::int`,
      createdAt: teamsTable.createdAt,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .leftJoin(studentsTable, eq(studentsTable.teamId, teamsTable.id))
    .where(eq(teamsTable.id, teamId))
    .groupBy(teamsTable.id, groupsTable.name);
  return row ?? null;
}

function buildContainerStateResponse(
  teamId: number,
  groupSlug: string,
  letter: string,
  info: ContainerInfo,
  baseDomain: string | null,
) {
  return {
    teamId,
    exists: info.exists,
    state: info.state,
    containerName: teamContainerName(groupSlug, letter),
    publicUrl: baseDomain ? teamPublicUrl(groupSlug, letter, baseDomain) : null,
    startedAt: info.startedAt,
  };
}

// Lanza el despliegue async del contenedor del equipo. Persiste status/error en BD.
function spawnTeamDeploy(req: Parameters<Parameters<IRouter["post"]>[1]>[0], teamId: number) {
  void (async () => {
    const team = await loadTeamFull(teamId);
    if (!team) return;
    const baseDomain = await getBaseDomain();
    if (!baseDomain) {
      await db
        .update(teamsTable)
        .set({ dolibarrSyncStatus: "error", dolibarrSyncError: "Falta dominio base" })
        .where(eq(teamsTable.id, teamId));
      return;
    }
    const groupSlug = groupNameToSlug(team.groupName);
    try {
      const result = await deployTeamDolibarr(
        {
          groupSlug,
          letter: team.letter,
          teamName: team.name,
          groupName: team.groupName,
          teacherUsername: team.teacherUsername,
          teacherPassword: team.teacherDolibarrPassword,
          teacherEmail: team.teacherEmail,
        },
        readDeployEnv(baseDomain),
      );
      await db
        .update(teamsTable)
        .set({
          dolibarrSyncStatus: result.state === "running" ? "synced" : "error",
          dolibarrSyncError: null,
        })
        .where(eq(teamsTable.id, teamId));
      await logActivity({
        action: "deploy_team",
        entityType: "team",
        entityId: teamId,
        entityName: `${team.name} (${team.letter})`,
        details: `Contenedor ${result.containerName} desplegado en ${result.hostname}`,
      });
    } catch (err) {
      const message = describeError(err);
      req.log.error({ err, teamId, letter: team.letter, groupSlug }, "Deploy equipo falló");
      await db
        .update(teamsTable)
        .set({ dolibarrSyncStatus: "error", dolibarrSyncError: message })
        .where(eq(teamsTable.id, teamId));
    }
  })();
}

// ── GET /teams ──────────────────────────────────────────────────────────────

router.get("/teams", async (req, res) => {
  const groupIdRaw = req.query.groupId;
  const groupId =
    typeof groupIdRaw === "string" && /^\d+$/.test(groupIdRaw) ? Number(groupIdRaw) : undefined;

  const rows = await db
    .select({
      id: teamsTable.id,
      groupId: teamsTable.groupId,
      groupName: groupsTable.name,
      letter: teamsTable.letter,
      name: teamsTable.name,
      dolibarrSyncStatus: teamsTable.dolibarrSyncStatus,
      dolibarrSyncError: teamsTable.dolibarrSyncError,
      memberCount: sql<number>`count(${studentsTable.id})::int`,
      createdAt: teamsTable.createdAt,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .leftJoin(studentsTable, eq(studentsTable.teamId, teamsTable.id))
    .where(groupId ? eq(teamsTable.groupId, groupId) : undefined)
    .groupBy(teamsTable.id, groupsTable.name)
    .orderBy(teamsTable.groupId, teamsTable.letter);

  res.json(rows);
});

// ── POST /teams — crear equipo + lanzar deploy async ─────────────────────────

router.post("/teams", async (req, res) => {
  const groupId = Number(req.body?.groupId);
  const name = String(req.body?.name ?? "").trim();
  if (!Number.isFinite(groupId) || groupId <= 0) {
    res.status(400).json({ error: "groupId requerido" });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "name requerido" });
    return;
  }

  const [group] = await db
    .select({ id: groupsTable.id, teacherId: groupsTable.teacherId })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (!group) {
    res.status(404).json({ error: "Grupo no encontrado" });
    return;
  }

  const usedLetters = await db
    .select({ letter: teamsTable.letter })
    .from(teamsTable)
    .where(eq(teamsTable.groupId, groupId));

  let letter: string;
  try {
    letter = nextLetter(usedLetters.map((r) => r.letter));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Sin letras libres" });
    return;
  }

  const gate = canOrchestrate();
  const baseDomain = await getBaseDomain();

  const initialStatus = gate.ok && baseDomain ? "deploying" : "pending";

  const [team] = await db
    .insert(teamsTable)
    .values({ groupId, letter, name, dolibarrSyncStatus: initialStatus, dolibarrSyncError: null })
    .returning();

  await logActivity({
    action: "create_team",
    entityType: "team",
    entityId: team.id,
    entityName: `${name} (${letter})`,
    details: `Equipo ${letter} creado en grupo ${groupId}`,
  });

  // Lanzar deploy async si es posible
  if (initialStatus === "deploying") {
    spawnTeamDeploy(req, team.id);
  }

  const row = await listTeamRow(team.id);
  res.status(202).json(row);
});

// ── GET /teams/:id — detalle + miembros ─────────────────────────────────────

router.get("/teams/:id", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const team = await loadTeamFull(id);
  if (!team) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }

  const members = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      username: studentsTable.username,
      email: studentsTable.email,
    })
    .from(studentsTable)
    .where(eq(studentsTable.teamId, id));

  const baseDomain = await getBaseDomain();
  const groupSlug = groupNameToSlug(team.groupName);
  const url = baseDomain ? teamPublicUrl(groupSlug, team.letter, baseDomain) : null;

  const row = await listTeamRow(id);
  res.json({
    ...row,
    members,
    publicUrl: url,
    containerName: teamContainerName(groupSlug, team.letter),
    teacherUsername: team.teacherUsername,
  });
});

// ── POST /teams/:id/deploy — (re)despliegue idempotente ─────────────────────

router.post("/teams/:id/deploy", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }

  const gate = canOrchestrate();
  if (!gate.ok) { res.status(503).json({ error: gate.reason }); return; }

  const baseDomain = await getBaseDomain();
  if (!baseDomain) {
    res.status(400).json({ error: "Falta configurar el dominio base en Configuración → Dominio base." });
    return;
  }

  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }

  if (!team.teacherDolibarrPassword) {
    res.status(400).json({
      error: `El profesor ${team.teacherUsername} no tiene Dolibarr individual desplegado. Despliégalo primero (sus credenciales se reutilizan como admin del Dolibarr del equipo).`,
    });
    return;
  }

  await db
    .update(teamsTable)
    .set({ dolibarrSyncStatus: "deploying", dolibarrSyncError: null })
    .where(eq(teamsTable.id, id));

  res.status(202).json({
    teamId: id,
    status: "deploying" as const,
    containerName: null,
    publicUrl: null,
    containerState: null,
    error: null,
  });

  spawnTeamDeploy(req, id);
});

// ── Lifecycle endpoints del contenedor del equipo ──────────────────────────

router.post("/teams/:id/container/start", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
  const groupSlug = groupNameToSlug(team.groupName);
  try {
    const info = await startTeamContainer(groupSlug, team.letter);
    const baseDomain = await getBaseDomain();
    res.json(buildContainerStateResponse(id, groupSlug, team.letter, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: describeError(err) });
  }
});

router.post("/teams/:id/container/stop", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
  const groupSlug = groupNameToSlug(team.groupName);
  try {
    const info = await stopTeamContainer(groupSlug, team.letter);
    const baseDomain = await getBaseDomain();
    res.json(buildContainerStateResponse(id, groupSlug, team.letter, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: describeError(err) });
  }
});

router.post("/teams/:id/container/restart", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
  const groupSlug = groupNameToSlug(team.groupName);
  try {
    const info = await restartTeamContainer(groupSlug, team.letter);
    const baseDomain = await getBaseDomain();
    res.json(buildContainerStateResponse(id, groupSlug, team.letter, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: describeError(err) });
  }
});

router.delete("/teams/:id/container", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
  const groupSlug = groupNameToSlug(team.groupName);
  try {
    await destroyTeamDolibarr(groupSlug, team.letter);
    await db
      .update(teamsTable)
      .set({ dolibarrSyncStatus: "pending", dolibarrSyncError: null })
      .where(eq(teamsTable.id, id));
    await logActivity({
      action: "destroy_team_dolibarr",
      entityType: "team",
      entityId: id,
      entityName: `${team.name} (${team.letter})`,
      details: `Contenedor + BD del equipo eliminados`,
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: describeError(err) });
  }
});

router.get("/teams/:id/container/state", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
  const groupSlug = groupNameToSlug(team.groupName);
  try {
    const info = await getTeamContainerInfo(groupSlug, team.letter);
    const baseDomain = await getBaseDomain();
    res.json(buildContainerStateResponse(id, groupSlug, team.letter, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: describeError(err) });
  }
});

// ── DELETE /teams/:id — borra equipo (destruye contenedor y reanuda miembros) ─

router.delete("/teams/:id", async (req, res) => {
  const id = parseTeamId(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const team = await loadTeamFull(id);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }
  const groupSlug = groupNameToSlug(team.groupName);

  // 1) Liberar miembros y reanudar sus Dolibarrs individuales
  const members = await db
    .select({ id: studentsTable.id, username: studentsTable.username })
    .from(studentsTable)
    .where(eq(studentsTable.teamId, id));

  await db.update(studentsTable).set({ teamId: null }).where(eq(studentsTable.teamId, id));

  for (const m of members) {
    await startStudentContainer(m.username).catch((err) =>
      logger.warn({ err, username: m.username }, "No se pudo reanudar Dolibarr individual al borrar equipo"),
    );
  }

  // 2) Destruir contenedor + BD del equipo
  await destroyTeamDolibarr(groupSlug, team.letter).catch((err) =>
    logger.warn({ err, teamId: id }, "No se pudo destruir contenedor/BD del equipo"),
  );

  // 3) Borrar fila + ruta Traefik (idempotente)
  await removeTeamRoute(groupSlug, team.letter).catch((err) =>
    logger.warn({ err, teamId: id }, "No se pudo eliminar ruta Traefik equipo"),
  );

  await db.delete(teamsTable).where(eq(teamsTable.id, id));

  await logActivity({
    action: "delete_team",
    entityType: "team",
    entityId: id,
    entityName: team.name,
    details: `Equipo ${team.letter} eliminado (${members.length} miembros liberados)`,
  });

  res.status(204).send();
});

// ── POST /teams/:id/members — añadir alumno al equipo ───────────────────────

router.post("/teams/:id/members", async (req, res) => {
  const teamId = parseTeamId(req.params.id);
  const studentId = Number(req.body?.studentId);
  if (!teamId || !Number.isFinite(studentId) || studentId <= 0) {
    res.status(400).json({ error: "teamId/studentId inválidos" });
    return;
  }

  const team = await loadTeamFull(teamId);
  if (!team) { res.status(404).json({ error: "Equipo no encontrado" }); return; }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  if (student.groupId !== team.groupId) {
    res.status(400).json({ error: "El alumno no pertenece al grupo del equipo" });
    return;
  }

  const groupSlug = groupNameToSlug(team.groupName);

  // 1) Marcar como miembro
  await db.update(studentsTable).set({ teamId }).where(eq(studentsTable.id, studentId));

  // 2) Pausar Dolibarr individual del alumno (best effort — si no existe, no falla)
  await stopStudentContainer(student.username).catch((err) =>
    logger.warn({ err, username: student.username }, "No se pudo pausar Dolibarr individual al unirse al equipo"),
  );

  // 3) Provisionar usuario alumno en el Dolibarr DEL EQUIPO (si está desplegado)
  let provisioned = false;
  let provisionError: string | null = null;
  if (team.dolibarrSyncStatus === "synced" && team.teacherDolibarrPassword) {
    try {
      const config = await getTeamDolibarrConfig({
        groupSlug,
        letter: team.letter,
        teacherUsername: team.teacherUsername,
        teacherPassword: team.teacherDolibarrPassword,
      });
      const password = student.dolibarrPassword ?? null;
      if (!password) {
        provisionError = "El alumno no tiene dolibarrPassword (despliega su Dolibarr individual antes para inicializarla).";
      } else {
        await createDolibarrUser(config, {
          login: student.username,
          password,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          admin: false,
        });
        provisioned = true;
      }
    } catch (err) {
      provisionError = describeError(err);
      logger.error({ err, studentId, teamId }, "Falló provisión usuario en Dolibarr del equipo");
    }
  } else if (team.dolibarrSyncStatus !== "synced") {
    provisionError = `Dolibarr del equipo no está desplegado (status: ${team.dolibarrSyncStatus}). El alumno será provisionado cuando termine el deploy.`;
  }

  await logActivity({
    action: "add_team_member",
    entityType: "team",
    entityId: teamId,
    entityName: team.name,
    details: `Alumno ${student.username} añadido al equipo ${team.letter}${provisioned ? " (provisionado en Dolibarr)" : ""}`,
  });

  res.json({ ok: true, provisioned, provisionError });
});

// ── DELETE /teams/:id/members/:studentId — quitar alumno ────────────────────

router.delete("/teams/:id/members/:studentId", async (req, res) => {
  const teamId = parseTeamId(req.params.id);
  const studentId = Number(req.params.studentId);
  if (!teamId || !Number.isFinite(studentId)) {
    res.status(400).json({ error: "IDs inválidos" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teamId, teamId)))
    .limit(1);
  if (!student) { res.status(404).json({ error: "Alumno no es miembro de este equipo" }); return; }

  const team = await loadTeamFull(teamId);
  const groupSlug = team ? groupNameToSlug(team.groupName) : null;

  // 1) Deprovisionar usuario del Dolibarr DEL EQUIPO (best effort)
  if (team && groupSlug && team.dolibarrSyncStatus === "synced" && team.teacherDolibarrPassword) {
    try {
      const config = await getTeamDolibarrConfig({
        groupSlug,
        letter: team.letter,
        teacherUsername: team.teacherUsername,
        teacherPassword: team.teacherDolibarrPassword,
      });
      const userId = await findDolibarrUserIdByLogin(config, student.username);
      if (userId) await deleteDolibarrUser(config, userId);
    } catch (err) {
      logger.warn({ err, studentId, teamId }, "No se pudo eliminar usuario Dolibarr del equipo (continúa)");
    }
  }

  // 2) Sacar al alumno del equipo
  await db.update(studentsTable).set({ teamId: null }).where(eq(studentsTable.id, studentId));

  // 3) Reanudar Dolibarr individual del alumno (best effort — si no existe, ignorar)
  await startStudentContainer(student.username).catch((err) =>
    logger.warn({ err, username: student.username }, "No se pudo reanudar Dolibarr individual al salir del equipo"),
  );

  await logActivity({
    action: "remove_team_member",
    entityType: "team",
    entityId: teamId,
    entityName: team?.name ?? `equipo #${teamId}`,
    details: `Alumno ${student.username} eliminado del equipo`,
  });

  res.json({ ok: true });
});

export default router;
