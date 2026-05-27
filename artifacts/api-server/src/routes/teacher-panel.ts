// Rutas del panel del profesor: scope automático a SUS grupos/alumnos.
// Todas requieren el middleware `requireTeacher` (en index.ts).
import { Router, type IRouter } from "express";
import { eq, and, inArray, sql, ilike, or, type SQL } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import {
  db,
  studentsTable,
  groupsTable,
  teachersTable,
  teamsTable,
} from "@workspace/db";
import { requireTeacher, type TeacherRequest } from "../middleware/requireTeacher";
import { logActivity } from "../lib/activity";
import { getBaseDomain } from "./settings";
import {
  deployStudentDolibarr,
  destroyStudentDolibarr,
  startStudentContainer,
  stopStudentContainer,
  getStudentContainerInfo,
  readDeployEnv,
  canOrchestrate,
} from "../lib/student-deploy";
import { containerName, publicUrl } from "../lib/student-dolibarr";
import {
  containerName as teacherContainerName,
  publicUrl as teacherPublicUrl,
} from "../lib/teacher-dolibarr";
import { getTeacherContainerInfo } from "../lib/teacher-deploy";
import { ensureStudentDatabase, isMariaDBConfigured } from "../lib/mariadb";
import { dbName, dbUser, invalidateTokenCache } from "../lib/student-dolibarr";
import { nextLetter, groupNameToSlug, publicUrl as teamPublicUrl } from "../lib/team-dolibarr";
import { writeTeamRoute, removeTeamRoute } from "../lib/traefik-config";
import { getTeacherDolibarrConfig } from "../lib/teacher-dolibarr";
import { createDolibarrUser, deleteDolibarrUser, findDolibarrUserIdByLogin } from "../lib/dolibarr";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use("/teacher", requireTeacher);

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function generatePassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

// Verifica que el alumno pertenece a un grupo del profesor autenticado
async function loadOwnedStudent(teacherId: number, studentId: number) {
  const [row] = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      email: studentsTable.email,
      username: studentsTable.username,
      groupId: studentsTable.groupId,
      teamId: studentsTable.teamId,
      companyName: studentsTable.companyName,
      dolibarrPassword: studentsTable.dolibarrPassword,
      dolibarrSyncStatus: studentsTable.dolibarrSyncStatus,
    })
    .from(studentsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, studentsTable.groupId))
    .where(and(eq(studentsTable.id, studentId), eq(groupsTable.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

// ── GET /teacher/me ───────────────────────────────────────────────────────────

router.get("/teacher/me", (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  res.json({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email,
    username: t.username,
    dolibarrSyncStatus: t.dolibarrSyncStatus,
  });
});

// ── GET /teacher/me/dolibarr — credenciales para acceso directo ──────────────

router.get("/teacher/me/dolibarr", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const baseDomain = await getBaseDomain();
  const deployed = baseDomain && t.dolibarrSyncStatus === "synced" && t.dolibarrPassword;
  res.json({
    deployed: Boolean(deployed),
    publicUrl: deployed ? teacherPublicUrl(t.username, baseDomain!) : null,
    containerName: teacherContainerName(t.username),
    dolibarrUsername: deployed ? t.username : null,
    dolibarrPassword: deployed ? t.dolibarrPassword : null,
  });
});

// ── GET /teacher/me/groups ────────────────────────────────────────────────────

router.get("/teacher/me/groups", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const groups = await db
    .select({
      id: groupsTable.id,
      name: groupsTable.name,
      courseYear: groupsTable.courseYear,
      description: groupsTable.description,
      studentCount: sql<number>`count(${studentsTable.id})::int`,
      createdAt: groupsTable.createdAt,
    })
    .from(groupsTable)
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(groupsTable.teacherId, t.id))
    .groupBy(groupsTable.id);
  res.json(groups);
});

// ── GET /teacher/me/stats ─────────────────────────────────────────────────────

router.get("/teacher/me/stats", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const [stats] = await db
    .select({
      groupCount: sql<number>`count(distinct ${groupsTable.id})::int`,
      studentCount: sql<number>`count(distinct ${studentsTable.id})::int`,
      activeContainers: sql<number>`count(distinct case when ${studentsTable.dolibarrSyncStatus} = 'synced' then ${studentsTable.id} end)::int`,
    })
    .from(groupsTable)
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(groupsTable.teacherId, t.id));

  const [teamStats] = await db
    .select({ teamCount: sql<number>`count(${teamsTable.id})::int` })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .where(eq(groupsTable.teacherId, t.id));

  res.json({
    groupCount: stats?.groupCount ?? 0,
    studentCount: stats?.studentCount ?? 0,
    activeContainers: stats?.activeContainers ?? 0,
    teamCount: teamStats?.teamCount ?? 0,
  });
});

// ── GET /teacher/me/students ──────────────────────────────────────────────────

router.get("/teacher/me/students", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const groupId = typeof req.query.groupId === "string" ? Number(req.query.groupId) : NaN;

  const conditions: SQL[] = [eq(groupsTable.teacherId, t.id)];
  if (Number.isFinite(groupId) && groupId > 0) {
    conditions.push(eq(studentsTable.groupId, groupId));
  }
  if (search) {
    const s = `%${search}%`;
    const searchCond = or(
      ilike(studentsTable.firstName, s),
      ilike(studentsTable.lastName, s),
      ilike(studentsTable.email, s),
      ilike(studentsTable.username, s),
    );
    if (searchCond) conditions.push(searchCond);
  }

  const rows = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      email: studentsTable.email,
      username: studentsTable.username,
      groupId: studentsTable.groupId,
      groupName: groupsTable.name,
      teamId: studentsTable.teamId,
      dolibarrSyncStatus: studentsTable.dolibarrSyncStatus,
      dolibarrSyncError: studentsTable.dolibarrSyncError,
      dolibarrPassword: studentsTable.dolibarrPassword,
      companyName: studentsTable.companyName,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, studentsTable.groupId))
    .where(and(...conditions));

  res.json(rows);
});

// ── POST /teacher/me/students — crear alumno (en uno de SUS grupos) ──────────

router.post("/teacher/me/students", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const body = req.body ?? {};
  const groupId = Number(body.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    res.status(400).json({ error: "groupId requerido" });
    return;
  }
  const [group] = await db
    .select({ id: groupsTable.id, teacherId: groupsTable.teacherId })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (!group || group.teacherId !== t.id) {
    res.status(403).json({ error: "Grupo no pertenece al profesor" });
    return;
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!firstName || !lastName || !email || !username || !password) {
    res.status(400).json({ error: "Faltan campos obligatorios" });
    return;
  }

  try {
    const [created] = await db
      .insert(studentsTable)
      .values({
        firstName,
        lastName,
        email,
        username,
        passwordHash: hashPassword(password),
        dolibarrPassword: password,
        groupId,
        companyName: body.companyName ? String(body.companyName) : null,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: "Email o usuario duplicado" });
  }
});

// ── PATCH /teacher/me/students/:id ───────────────────────────────────────────

router.patch("/teacher/me/students/:id", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  const body = req.body ?? {};

  // Si cambia de grupo, el nuevo grupo también debe ser del profe
  if (body.groupId !== undefined) {
    const [g] = await db
      .select({ teacherId: groupsTable.teacherId })
      .from(groupsTable)
      .where(eq(groupsTable.id, Number(body.groupId)))
      .limit(1);
    if (!g || g.teacherId !== t.id) {
      res.status(403).json({ error: "El grupo destino no es del profesor" });
      return;
    }
  }

  await db
    .update(studentsTable)
    .set({
      ...(body.firstName !== undefined && { firstName: String(body.firstName) }),
      ...(body.lastName !== undefined && { lastName: String(body.lastName) }),
      ...(body.email !== undefined && { email: String(body.email) }),
      ...(body.companyName !== undefined && { companyName: body.companyName ? String(body.companyName) : null }),
      ...(body.groupId !== undefined && { groupId: Number(body.groupId) }),
    })
    .where(eq(studentsTable.id, id));

  res.json({ ok: true });
});

// ── DELETE /teacher/me/students/:id ──────────────────────────────────────────

router.delete("/teacher/me/students/:id", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  res.status(204).send();
});

// ── POST /teacher/me/students/:id/reset-password ─────────────────────────────

router.post("/teacher/me/students/:id/reset-password", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  const newPassword = generatePassword();
  const newHash = hashPassword(newPassword);
  await db
    .update(studentsTable)
    .set({ dolibarrPassword: newPassword, passwordHash: newHash })
    .where(eq(studentsTable.id, id));

  if (isMariaDBConfigured()) {
    await ensureStudentDatabase(dbName(student.username), dbUser(student.username), newPassword).catch(() => undefined);
    invalidateTokenCache(student.username);
  }

  await logActivity({
    action: "teacher_reset_student_password",
    entityType: "student",
    entityId: id,
    entityName: `${student.firstName} ${student.lastName}`,
    details: `Contraseña restablecida por profesor ${t.username}`,
  });

  res.json({ ok: true, newPassword });
});

// ── Lifecycle Dolibarr individual de cada alumno ─────────────────────────────

router.post("/teacher/me/students/:id/dolibarr/deploy", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  const gate = canOrchestrate();
  if (!gate.ok) { res.status(503).json({ error: gate.reason }); return; }
  const baseDomain = await getBaseDomain();
  if (!baseDomain) { res.status(400).json({ error: "Falta dominio base" }); return; }

  try {
    const result = await deployStudentDolibarr(student, readDeployEnv(baseDomain));
    await db
      .update(studentsTable)
      .set({
        dolibarrPassword: result.adminPassword,
        dolibarrSyncStatus: result.state === "running" ? "synced" : "error",
        dolibarrSyncError: null,
      })
      .where(eq(studentsTable.id, id));
    res.json({ ok: true, publicUrl: result.publicUrl, state: result.state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    await db
      .update(studentsTable)
      .set({ dolibarrSyncStatus: "error", dolibarrSyncError: message })
      .where(eq(studentsTable.id, id));
    res.status(500).json({ error: message });
  }
});

router.post("/teacher/me/students/:id/dolibarr/start", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    const info = await startStudentContainer(student.username);
    res.json({ ok: true, state: info.state });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/teacher/me/students/:id/dolibarr/stop", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    const info = await stopStudentContainer(student.username);
    res.json({ ok: true, state: info.state });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/teacher/me/students/:id/dolibarr/state", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  const baseDomain = await getBaseDomain();
  try {
    const info = await getStudentContainerInfo(student.username);
    res.json({
      studentId: id,
      exists: info.exists,
      state: info.state,
      containerName: containerName(student.username),
      publicUrl: baseDomain ? publicUrl(student.username, baseDomain) : null,
      startedAt: info.startedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/teacher/me/students/:id/dolibarr", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const student = await loadOwnedStudent(t.id, id);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    await destroyStudentDolibarr(student.username);
    await db
      .update(studentsTable)
      .set({ dolibarrPassword: null, dolibarrSyncStatus: "pending", dolibarrSyncError: null })
      .where(eq(studentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── Equipos del profesor ─────────────────────────────────────────────────────

router.get("/teacher/me/teams", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const rows = await db
    .select({
      id: teamsTable.id,
      groupId: teamsTable.groupId,
      groupName: groupsTable.name,
      letter: teamsTable.letter,
      name: teamsTable.name,
      dolibarrSyncStatus: teamsTable.dolibarrSyncStatus,
      memberCount: sql<number>`count(${studentsTable.id})::int`,
      createdAt: teamsTable.createdAt,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .leftJoin(studentsTable, eq(studentsTable.teamId, teamsTable.id))
    .where(eq(groupsTable.teacherId, t.id))
    .groupBy(teamsTable.id, groupsTable.name)
    .orderBy(teamsTable.groupId, teamsTable.letter);
  res.json(rows);
});

router.post("/teacher/me/teams", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const groupId = Number(req.body?.groupId);
  const name = String(req.body?.name ?? "").trim();
  if (!Number.isFinite(groupId) || groupId <= 0 || !name) {
    res.status(400).json({ error: "groupId y name requeridos" });
    return;
  }
  const [g] = await db
    .select({ teacherId: groupsTable.teacherId })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (!g || g.teacherId !== t.id) {
    res.status(403).json({ error: "Grupo no pertenece al profesor" });
    return;
  }
  const used = await db
    .select({ letter: teamsTable.letter })
    .from(teamsTable)
    .where(eq(teamsTable.groupId, groupId));
  const letter = nextLetter(used.map((r) => r.letter));
  const [team] = await db
    .insert(teamsTable)
    .values({ groupId, letter, name })
    .returning();
  res.status(201).json(team);
});

router.delete("/teacher/me/teams/:id", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const [team] = await db
    .select({
      teamId: teamsTable.id,
      letter: teamsTable.letter,
      groupName: groupsTable.name,
      teacherId: groupsTable.teacherId,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .where(eq(teamsTable.id, id))
    .limit(1);
  if (!team || team.teacherId !== t.id) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }
  await db.update(studentsTable).set({ teamId: null }).where(eq(studentsTable.teamId, id));
  const groupSlug = groupNameToSlug(team.groupName);
  await removeTeamRoute(groupSlug, team.letter).catch(() => undefined);
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

router.get("/teacher/me/teams/:id", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const id = Number(req.params.id);
  const [team] = await db
    .select({
      id: teamsTable.id,
      groupId: teamsTable.groupId,
      letter: teamsTable.letter,
      name: teamsTable.name,
      groupName: groupsTable.name,
      teacherId: groupsTable.teacherId,
      teacherUsername: teachersTable.username,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .innerJoin(teachersTable, eq(teachersTable.id, groupsTable.teacherId))
    .where(eq(teamsTable.id, id))
    .limit(1);
  if (!team || team.teacherId !== t.id) {
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
  res.json({
    ...team,
    members,
    publicUrl: baseDomain ? teamPublicUrl(groupSlug, team.letter, baseDomain) : null,
  });
});

router.post("/teacher/me/teams/:id/members", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const teamId = Number(req.params.id);
  const studentId = Number(req.body?.studentId);
  // Verifica que el equipo y el alumno son del profe
  const [team] = await db
    .select({
      id: teamsTable.id,
      letter: teamsTable.letter,
      groupId: teamsTable.groupId,
      groupName: groupsTable.name,
      teacherId: groupsTable.teacherId,
      teacherUsername: teachersTable.username,
      teacherDolibarrPassword: teachersTable.dolibarrPassword,
      teacherSyncStatus: teachersTable.dolibarrSyncStatus,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .innerJoin(teachersTable, eq(teachersTable.id, groupsTable.teacherId))
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  if (!team || team.teacherId !== t.id) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }
  const student = await loadOwnedStudent(t.id, studentId);
  if (!student || student.groupId !== team.groupId) {
    res.status(400).json({ error: "Alumno no pertenece al grupo del equipo" });
    return;
  }

  await db.update(studentsTable).set({ teamId }).where(eq(studentsTable.id, studentId));
  await stopStudentContainer(student.username).catch(() => undefined);

  let provisioned = false;
  let provisionError: string | null = null;
  if (team.teacherSyncStatus === "synced" && team.teacherDolibarrPassword) {
    try {
      const config = await getTeacherDolibarrConfig({
        username: team.teacherUsername,
        dolibarrPassword: team.teacherDolibarrPassword,
      });
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
      await db
        .update(studentsTable)
        .set({ dolibarrPassword: password })
        .where(eq(studentsTable.id, studentId));
      provisioned = true;
    } catch (err) {
      provisionError = err instanceof Error ? err.message : "Error provisión";
      logger.error({ err, studentId, teamId }, "Falló provisión usuario en equipo");
    }
  }

  const baseDomain = await getBaseDomain();
  if (baseDomain) {
    const groupSlug = groupNameToSlug(team.groupName);
    await writeTeamRoute(team.teacherUsername, groupSlug, team.letter, baseDomain).catch(() => undefined);
    await db
      .update(teamsTable)
      .set({
        dolibarrSyncStatus: provisioned ? "synced" : provisionError ? "error" : "pending",
        dolibarrSyncError: provisionError,
      })
      .where(eq(teamsTable.id, teamId));
  }

  res.json({ ok: true, provisioned, provisionError });
});

router.delete("/teacher/me/teams/:id/members/:studentId", async (req, res) => {
  const t = (req as unknown as TeacherRequest).teacher;
  const teamId = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  // Verifica ownership
  const [team] = await db
    .select({
      teacherId: groupsTable.teacherId,
      teacherUsername: teachersTable.username,
      teacherDolibarrPassword: teachersTable.dolibarrPassword,
      teacherSyncStatus: teachersTable.dolibarrSyncStatus,
    })
    .from(teamsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, teamsTable.groupId))
    .innerJoin(teachersTable, eq(teachersTable.id, groupsTable.teacherId))
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  if (!team || team.teacherId !== t.id) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }
  const [member] = await db
    .select({ username: studentsTable.username })
    .from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teamId, teamId)))
    .limit(1);
  if (!member) {
    res.status(404).json({ error: "Alumno no es miembro de este equipo" });
    return;
  }

  if (team.teacherSyncStatus === "synced" && team.teacherDolibarrPassword) {
    try {
      const config = await getTeacherDolibarrConfig({
        username: team.teacherUsername,
        dolibarrPassword: team.teacherDolibarrPassword,
      });
      const userId = await findDolibarrUserIdByLogin(config, member.username);
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
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teamId, teamId)));
  res.json({ ok: true });
});

export default router;
