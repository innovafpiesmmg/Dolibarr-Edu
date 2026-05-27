import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { db, teamsTable, groupsTable, studentsTable, teachersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { logActivity } from "../lib/activity";
import { nextLetter, groupNameToSlug, publicUrl as teamPublicUrl } from "../lib/team-dolibarr";
import { writeTeamRoute, removeTeamRoute } from "../lib/traefik-config";
import { getBaseDomain } from "./settings";
import { stopStudentContainer } from "../lib/student-deploy";
import { getTeacherDolibarrConfig } from "../lib/teacher-dolibarr";
import { createDolibarrUser, deleteDolibarrUser, findDolibarrUserIdByLogin } from "../lib/dolibarr";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      teacherDolibarrPassword: teachersTable.dolibarrPassword,
      teacherSyncStatus: teachersTable.dolibarrSyncStatus,
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

// ── GET /teams — listado global (admin) ───────────────────────────────────────

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

// ── POST /teams — crear equipo (letra autoasignada) ───────────────────────────

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
    .select({ id: groupsTable.id })
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

  const [team] = await db
    .insert(teamsTable)
    .values({ groupId, letter, name })
    .returning();

  await logActivity({
    action: "create_team",
    entityType: "team",
    entityId: team.id,
    entityName: `${name} (${letter})`,
    details: `Equipo ${letter} creado en grupo ${groupId}`,
  });

  const row = await listTeamRow(team.id);
  res.status(201).json(row);
});

// ── GET /teams/:id — detalle + miembros ──────────────────────────────────────

router.get("/teams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
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
    teacherUsername: team.teacherUsername,
  });
});

// ── DELETE /teams/:id ────────────────────────────────────────────────────────

router.delete("/teams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const team = await loadTeamFull(id);
  if (!team) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }

  // Quitar miembros (set teamId = null) y borrar ruta Traefik
  await db
    .update(studentsTable)
    .set({ teamId: null })
    .where(eq(studentsTable.teamId, id));

  const groupSlug = groupNameToSlug(team.groupName);
  await removeTeamRoute(groupSlug, team.letter).catch((err) =>
    logger.warn({ err, teamId: id }, "No se pudo eliminar ruta Traefik equipo"),
  );

  await db.delete(teamsTable).where(eq(teamsTable.id, id));

  await logActivity({
    action: "delete_team",
    entityType: "team",
    entityId: id,
    entityName: team.name,
    details: `Equipo ${team.letter} eliminado`,
  });

  res.status(204).send();
});

// ── POST /teams/:id/members — añadir alumno al equipo ────────────────────────

router.post("/teams/:id/members", async (req, res) => {
  const teamId = Number(req.params.id);
  const studentId = Number(req.body?.studentId);
  if (!Number.isFinite(teamId) || teamId <= 0 || !Number.isFinite(studentId) || studentId <= 0) {
    res.status(400).json({ error: "teamId/studentId inválidos" });
    return;
  }

  const team = await loadTeamFull(teamId);
  if (!team) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);
  if (!student) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  // Validación: el alumno debe pertenecer al mismo grupo que el equipo
  if (student.groupId !== team.groupId) {
    res.status(400).json({
      error: "El alumno no pertenece al grupo del equipo",
    });
    return;
  }

  // 1) Marcar al alumno como miembro del equipo
  await db
    .update(studentsTable)
    .set({ teamId })
    .where(eq(studentsTable.id, studentId));

  // 2) Detener el Dolibarr individual del alumno (si está corriendo, no falla si no existe)
  await stopStudentContainer(student.username).catch((err) =>
    logger.warn({ err, username: student.username }, "No se pudo detener Dolibarr individual al unirse al equipo"),
  );

  // 3) Provisionar el usuario en el Dolibarr del profesor (best effort)
  let provisioned = false;
  let provisionError: string | null = null;
  if (team.teacherSyncStatus === "synced" && team.teacherDolibarrPassword) {
    try {
      const config = await getTeacherDolibarrConfig({
        username: team.teacherUsername,
        dolibarrPassword: team.teacherDolibarrPassword,
      });
      // Usamos el passwordHash existente como semilla de contraseña aleatoria estable.
      // En producción, se pediría al alumno restablecer su contraseña.
      const password = createHash("sha256")
        .update(`team-member:${student.username}:${team.teacherUsername}:${teamId}`)
        .digest("hex")
        .slice(0, 24);
      await createDolibarrUser(config, {
        login: student.username,
        password,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        admin: false,
      });
      // Guardar la contraseña del Dolibarr de equipo en el campo dolibarrPassword del alumno
      // (se usa también en student-login cuando hay teamId).
      await db
        .update(studentsTable)
        .set({ dolibarrPassword: password })
        .where(eq(studentsTable.id, studentId));
      provisioned = true;
    } catch (err) {
      provisionError = err instanceof Error ? err.message : "Error provisionando usuario";
      logger.error({ err, studentId, teamId }, "Falló provisión usuario Dolibarr equipo");
    }
  }

  // 4) Escribir ruta Traefik del equipo (idempotente)
  const baseDomain = await getBaseDomain();
  if (baseDomain) {
    const groupSlug = groupNameToSlug(team.groupName);
    await writeTeamRoute(team.teacherUsername, groupSlug, team.letter, baseDomain).catch((err) =>
      logger.warn({ err, teamId }, "No se pudo escribir ruta Traefik equipo"),
    );
    // Actualiza estado de sync del equipo
    await db
      .update(teamsTable)
      .set({
        dolibarrSyncStatus: provisioned ? "synced" : provisionError ? "error" : "pending",
        dolibarrSyncError: provisionError,
      })
      .where(eq(teamsTable.id, teamId));
  }

  await logActivity({
    action: "add_team_member",
    entityType: "team",
    entityId: teamId,
    entityName: team.name,
    details: `Alumno ${student.username} añadido al equipo ${team.letter}`,
  });

  res.json({ ok: true, provisioned, provisionError });
});

// ── DELETE /teams/:id/members/:studentId — quitar alumno ─────────────────────

router.delete("/teams/:id/members/:studentId", async (req, res) => {
  const teamId = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  if (!Number.isFinite(teamId) || !Number.isFinite(studentId)) {
    res.status(400).json({ error: "IDs inválidos" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teamId, teamId)))
    .limit(1);
  if (!student) {
    res.status(404).json({ error: "Alumno no es miembro de este equipo" });
    return;
  }

  // Deprovisionar usuario del Dolibarr del profesor antes de soltar las credenciales.
  const team = await loadTeamFull(teamId);
  if (team?.teacherSyncStatus === "synced" && team.teacherDolibarrPassword) {
    try {
      const config = await getTeacherDolibarrConfig({
        username: team.teacherUsername,
        dolibarrPassword: team.teacherDolibarrPassword,
      });
      const userId = await findDolibarrUserIdByLogin(config, student.username);
      if (userId) {
        await deleteDolibarrUser(config, userId);
      }
    } catch (err) {
      logger.warn(
        { err, studentId, teamId },
        "No se pudo eliminar usuario Dolibarr del equipo (continúa)",
      );
    }
  }

  await db
    .update(studentsTable)
    .set({ teamId: null, dolibarrPassword: null })
    .where(eq(studentsTable.id, studentId));

  await logActivity({
    action: "remove_team_member",
    entityType: "team",
    entityId: teamId,
    entityName: `equipo #${teamId}`,
    details: `Alumno ${student.username} eliminado del equipo`,
  });

  res.json({ ok: true });
});

export default router;
