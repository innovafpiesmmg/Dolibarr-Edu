import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, studentsTable, groupsTable, teachersTable } from "@workspace/db";
import {
  deployStudentDolibarr,
  destroyStudentDolibarr,
  startStudentContainer,
  stopStudentContainer,
  getStudentContainerInfo,
  enableStudentModules,
  readDeployEnv,
  canOrchestrate,
} from "../lib/student-deploy";
import {
  deployTeacherDolibarr,
  destroyTeacherDolibarr,
  startTeacherContainer,
  stopTeacherContainer,
  getTeacherContainerInfo,
  enableTeacherModules,
} from "../lib/teacher-deploy";
import { containerName, publicUrl } from "../lib/student-dolibarr";
import {
  containerName as teacherContainerName,
  publicUrl as teacherPublicUrl,
} from "../lib/teacher-dolibarr";
import { getBaseDomain } from "./settings";
import { logActivity } from "../lib/activity";
import type { ContainerInfo } from "../lib/docker";

const router: IRouter = Router();

// Convierte CUALQUIER throw (Error, string, objeto de mysql2/dockerode, etc.)
// en un mensaje útil. Sin esto, "Error desconocido" oculta la verdadera causa.
function describeError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    return code ? `[${code}] ${err.message}` : err.message;
  }
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { code?: string; errno?: number; sqlMessage?: string; message?: string; reason?: string };
    const parts = [
      e.code,
      e.sqlMessage,
      e.message,
      e.reason,
      e.errno != null ? `errno=${e.errno}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(" — ");
    try { return JSON.stringify(err); } catch { /* noop */ }
  }
  return `Error desconocido (${String(err)})`;
}

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

  // El deploy real puede tardar hasta ~3 min (instalación inicial de Dolibarr +
  // migración de schema). Cualquier proxy (Cloudflare ~100s, navegador) cierra
  // la conexión antes. Por eso marcamos "deploying" y devolvemos al instante;
  // el frontend pollea /students/:id/dolibarr/state y la propia ficha del alumno.
  await db
    .update(studentsTable)
    .set({ dolibarrSyncStatus: "deploying", dolibarrSyncError: null })
    .where(eq(studentsTable.id, studentId));

  res.status(202).json({
    studentId,
    status: "deploying" as const,
    containerName: null,
    publicUrl: null,
    containerState: null,
    dolibarrPassword: null,
    error: null,
  });

  // Trabajo de fondo — no await; los errores se persisten en BD.
  void (async () => {
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
    } catch (err) {
      const message = describeError(err);
      req.log.error({ err, studentId, username: student.username }, "Deploy alumno falló");
      await db
        .update(studentsTable)
        .set({ dolibarrSyncStatus: "error", dolibarrSyncError: message })
        .where(eq(studentsTable.id, studentId));
    }
  })();
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

// Reaplica la activación de los módulos de Dolibarr (contabilidad, facturación,
// nóminas, SS...) en la BD del alumno. Útil para alumnos desplegados antes de
// que ampliáramos la lista por defecto, o si quieres reactivarlos tras toquetear.
router.post("/students/:id/dolibarr/modules", async (req, res) => {
  const studentId = parseStudentId(req.params.id);
  if (!studentId) { res.status(400).json({ error: "ID inválido" }); return; }
  const student = await loadStudent(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  try {
    const result = await enableStudentModules(student.username);
    await logActivity({
      action: "enable_student_modules",
      entityType: "student",
      entityId: studentId,
      entityName: `${student.firstName} ${student.lastName}`,
      details: `Módulos activados: ${result.enabled.join(", ")}`,
    });
    res.json({ studentId, enabled: result.enabled });
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

// ═══════════════════════════════════════════════════════════════════════════
// Teacher Dolibarr lifecycle (mirror exacto del flujo de alumno).
// ═══════════════════════════════════════════════════════════════════════════

function parseTeacherId(idRaw: string): number | null {
  const id = Number(idRaw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function loadTeacher(id: number) {
  const [t] = await db.select().from(teachersTable).where(eq(teachersTable.id, id)).limit(1);
  return t ?? null;
}

function buildTeacherStateResponse(
  teacherId: number,
  username: string,
  info: ContainerInfo,
  baseDomain: string | null,
) {
  return {
    teacherId,
    exists: info.exists,
    state: info.state,
    containerName: teacherContainerName(username),
    publicUrl: baseDomain ? teacherPublicUrl(username, baseDomain) : null,
    startedAt: info.startedAt,
  };
}

router.post("/teachers/:id/deploy", async (req, res) => {
  const teacherId = parseTeacherId(req.params.id);
  if (!teacherId) { res.status(400).json({ error: "ID de profesor inválido" }); return; }

  const gate = canOrchestrate();
  if (!gate.ok) { res.status(503).json({ error: gate.reason }); return; }

  const baseDomain = await getBaseDomain();
  if (!baseDomain) {
    res.status(400).json({ error: "Falta configurar el dominio base en Configuración → Dominio base." });
    return;
  }

  const teacher = await loadTeacher(teacherId);
  if (!teacher) { res.status(404).json({ error: "Profesor no encontrado" }); return; }

  // Async: ver explicación en el deploy de alumno.
  await db
    .update(teachersTable)
    .set({ dolibarrSyncStatus: "deploying", dolibarrSyncError: null })
    .where(eq(teachersTable.id, teacherId));

  res.status(202).json({
    teacherId,
    status: "deploying" as const,
    containerName: null,
    publicUrl: null,
    containerState: null,
    dolibarrPassword: null,
    error: null,
  });

  void (async () => {
    try {
      const result = await deployTeacherDolibarr(teacher, readDeployEnv(baseDomain));
      await db
        .update(teachersTable)
        .set({
          dolibarrPassword: result.adminPassword,
          dolibarrSyncStatus: result.state === "running" ? "synced" : "error",
          dolibarrSyncError: null,
        })
        .where(eq(teachersTable.id, teacherId));
      await logActivity({
        action: "deploy_teacher",
        entityType: "teacher",
        entityId: teacherId,
        entityName: `${teacher.firstName} ${teacher.lastName}`,
        details: `Contenedor ${result.containerName} desplegado en ${result.hostname}`,
      });
    } catch (err) {
      const message = describeError(err);
      req.log.error({ err, teacherId, username: teacher.username }, "Deploy profesor falló");
      await db
        .update(teachersTable)
        .set({ dolibarrSyncStatus: "error", dolibarrSyncError: message })
        .where(eq(teachersTable.id, teacherId));
    }
  })();
});

router.post("/teachers/:id/dolibarr/start", async (req, res) => {
  const teacherId = parseTeacherId(req.params.id);
  if (!teacherId) { res.status(400).json({ error: "ID inválido" }); return; }
  const teacher = await loadTeacher(teacherId);
  if (!teacher) { res.status(404).json({ error: "Profesor no encontrado" }); return; }
  try {
    const info = await startTeacherContainer(teacher.username);
    const baseDomain = await getBaseDomain();
    res.json(buildTeacherStateResponse(teacherId, teacher.username, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/teachers/:id/dolibarr/stop", async (req, res) => {
  const teacherId = parseTeacherId(req.params.id);
  if (!teacherId) { res.status(400).json({ error: "ID inválido" }); return; }
  const teacher = await loadTeacher(teacherId);
  if (!teacher) { res.status(404).json({ error: "Profesor no encontrado" }); return; }
  try {
    const info = await stopTeacherContainer(teacher.username);
    const baseDomain = await getBaseDomain();
    res.json(buildTeacherStateResponse(teacherId, teacher.username, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/teachers/:id/dolibarr", async (req, res) => {
  const teacherId = parseTeacherId(req.params.id);
  if (!teacherId) { res.status(400).json({ error: "ID inválido" }); return; }
  const teacher = await loadTeacher(teacherId);
  if (!teacher) { res.status(404).json({ error: "Profesor no encontrado" }); return; }
  try {
    await destroyTeacherDolibarr(teacher.username);
    await db
      .update(teachersTable)
      .set({
        dolibarrPassword: null,
        dolibarrSyncStatus: "pending",
        dolibarrSyncError: null,
      })
      .where(eq(teachersTable.id, teacherId));
    await logActivity({
      action: "destroy_teacher_dolibarr",
      entityType: "teacher",
      entityId: teacherId,
      entityName: `${teacher.firstName} ${teacher.lastName}`,
      details: `Contenedor Dolibarr y BD del profesor eliminados`,
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/teachers/:id/dolibarr/modules", async (req, res) => {
  const teacherId = parseTeacherId(req.params.id);
  if (!teacherId) { res.status(400).json({ error: "ID inválido" }); return; }
  const teacher = await loadTeacher(teacherId);
  if (!teacher) { res.status(404).json({ error: "Profesor no encontrado" }); return; }
  try {
    const result = await enableTeacherModules(teacher.username);
    await logActivity({
      action: "enable_teacher_modules",
      entityType: "teacher",
      entityId: teacherId,
      entityName: `${teacher.firstName} ${teacher.lastName}`,
      details: `Módulos activados: ${result.enabled.join(", ")}`,
    });
    res.json({ teacherId, enabled: result.enabled });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/teachers/:id/dolibarr/state", async (req, res) => {
  const teacherId = parseTeacherId(req.params.id);
  if (!teacherId) { res.status(400).json({ error: "ID inválido" }); return; }
  const teacher = await loadTeacher(teacherId);
  if (!teacher) { res.status(404).json({ error: "Profesor no encontrado" }); return; }

  const baseDomain = await getBaseDomain();
  try {
    const info = await getTeacherContainerInfo(teacher.username);
    res.json(buildTeacherStateResponse(teacherId, teacher.username, info, baseDomain || null));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

export default router;
