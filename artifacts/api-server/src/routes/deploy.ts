import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, studentsTable, groupsTable } from "@workspace/db";
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
import { getBaseDomain } from "./settings";
import { logActivity } from "../lib/activity";
import type { ContainerInfo } from "../lib/docker";

const router: IRouter = Router();

function parseStudentId(idRaw: string): number | null {
  const id = Number(idRaw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function loadStudent(id: number) {
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  return s ?? null;
}

function buildContainerStateResponse(
  studentId: number,
  username: string,
  info: ContainerInfo,
  baseDomain: string | null,
) {
  return {
    studentId,
    exists: info.exists,
    state: info.state,
    containerName: containerName(username),
    publicUrl: baseDomain ? publicUrl(username, baseDomain) : null,
    startedAt: info.startedAt,
  };
}

// ── POST /students/:id/deploy ────────────────────────────────────────────────
router.post("/students/:id/deploy", async (req, res) => {
  const studentId = parseStudentId(req.params.id);
  if (!studentId) { res.status(400).json({ error: "ID de alumno inválido" }); return; }

  const gate = canOrchestrate();
  if (!gate.ok) { res.status(503).json({ error: gate.reason }); return; }

  const baseDomain = await getBaseDomain();
  if (!baseDomain) {
    res.status(400).json({ error: "Falta configurar el dominio base en Configuración → Dominio base." });
    return;
  }

  const student = await loadStudent(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  try {
    const result = await deployStudentDolibarr(student, readDeployEnv(baseDomain));

    await db
      .update(studentsTable)
      .set({
        dolibarrPassword: result.adminPassword,
        dolibarrSyncStatus: result.state === "running" ? "synced" : "error",
        dolibarrSyncError: null,
      })
      .where(eq(studentsTable.id, studentId));

    await logActivity({
      action: "deploy_student",
      entityType: "student",
      entityId: studentId,
      entityName: `${student.firstName} ${student.lastName}`,
      details: `Contenedor ${result.containerName} desplegado en ${result.hostname}`,
    });

    res.json({
      studentId,
      status: "synced" as const,
      containerName: result.containerName,
      publicUrl: result.publicUrl,
      containerState: result.state,
      dolibarrPassword: result.adminPassword,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    await db
      .update(studentsTable)
      .set({ dolibarrSyncStatus: "error", dolibarrSyncError: message })
      .where(eq(studentsTable.id, studentId));

    res.json({
      studentId,
      status: "error" as const,
      containerName: null,
      publicUrl: null,
      containerState: null,
      dolibarrPassword: null,
      error: message,
    });
  }
});

// ── POST /groups/:id/deploy-all ──────────────────────────────────────────────
router.post("/groups/:id/deploy-all", async (req, res) => {
  const groupId = Number(req.params.id);
  if (!Number.isFinite(groupId) || groupId <= 0) { res.status(400).json({ error: "ID de grupo inválido" }); return; }

  const [group] = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (!group) { res.status(404).json({ error: "Grupo no encontrado" }); return; }

  const gate = canOrchestrate();
  if (!gate.ok) { res.status(503).json({ error: gate.reason }); return; }

  const baseDomain = await getBaseDomain();
  if (!baseDomain) {
    res.status(400).json({ error: "Falta configurar el dominio base en Configuración." });
    return;
  }

  const students = await db.select().from(studentsTable).where(eq(studentsTable.groupId, groupId));
  const pending = students.filter((s) => s.dolibarrSyncStatus !== "synced" || !s.dolibarrPassword);
  const skipped = students.length - pending.length;

  const ctx = readDeployEnv(baseDomain);
  let deployed = 0;
  const errors: { studentId: number; username: string; error: string }[] = [];

  for (const student of pending) {
    try {
      const result = await deployStudentDolibarr(student, ctx);
      await db
        .update(studentsTable)
        .set({
          dolibarrPassword: result.adminPassword,
          dolibarrSyncStatus: result.state === "running" ? "synced" : "error",
          dolibarrSyncError: null,
        })
        .where(eq(studentsTable.id, student.id));
      deployed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      await db
        .update(studentsTable)
        .set({ dolibarrSyncStatus: "error", dolibarrSyncError: message })
        .where(eq(studentsTable.id, student.id));
      errors.push({ studentId: student.id, username: student.username, error: message });
    }
  }

  res.json({ deployed, skipped, errors });
});

// ── Lifecycle endpoints ──────────────────────────────────────────────────────
router.post("/students/:id/dolibarr/start", async (req, res) => {
  const studentId = parseStudentId(req.params.id);
  if (!studentId) { res.status(400).json({ error: "ID inválido" }); return; }
  const student = await loadStudent(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    const info = await startStudentContainer(student.username);
    const baseDomain = await getBaseDomain();
    res.json(buildContainerStateResponse(studentId, student.username, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/students/:id/dolibarr/stop", async (req, res) => {
  const studentId = parseStudentId(req.params.id);
  if (!studentId) { res.status(400).json({ error: "ID inválido" }); return; }
  const student = await loadStudent(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    const info = await stopStudentContainer(student.username);
    const baseDomain = await getBaseDomain();
    res.json(buildContainerStateResponse(studentId, student.username, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/students/:id/dolibarr", async (req, res) => {
  const studentId = parseStudentId(req.params.id);
  if (!studentId) { res.status(400).json({ error: "ID inválido" }); return; }
  const student = await loadStudent(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    await destroyStudentDolibarr(student.username);
    await db
      .update(studentsTable)
      .set({
        dolibarrPassword: null,
        dolibarrSyncStatus: "pending",
        dolibarrSyncError: null,
      })
      .where(eq(studentsTable.id, studentId));
    await logActivity({
      action: "destroy_student_dolibarr",
      entityType: "student",
      entityId: studentId,
      entityName: `${student.firstName} ${student.lastName}`,
      details: `Contenedor Dolibarr y BD eliminados`,
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/students/:id/dolibarr/state", async (req, res) => {
  const studentId = parseStudentId(req.params.id);
  if (!studentId) { res.status(400).json({ error: "ID inválido" }); return; }
  const student = await loadStudent(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  const baseDomain = await getBaseDomain();
  try {
    const info = await getStudentContainerInfo(student.username);
    res.json(buildContainerStateResponse(studentId, student.username, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

export default router;
