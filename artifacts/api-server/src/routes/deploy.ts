import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, studentsTable, groupsTable } from "@workspace/db";
import {
  createEntity,
  createDolibarrUser,
  generateDolibarrPassword,
  isDolibarrConfigured,
  describeDolibarrConfig,
} from "../lib/dolibarr";
import { getTaxSystem } from "./settings";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

router.post("/students/:id/deploy", async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) {
    res.status(400).json({ error: "ID de alumno inválido" });
    return;
  }

  if (!isDolibarrConfigured()) {
    res.status(503).json({ error: `Dolibarr no está configurado. ${describeDolibarrConfig()}` });
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

  if (student.dolibarrSyncStatus === "synced" && student.dolibarrEntityId) {
    res.json({
      studentId,
      status: "skipped",
      entityId: student.dolibarrEntityId,
      dolibarrPassword: student.dolibarrPassword ?? null,
      error: null,
    });
    return;
  }

  try {
    const taxSystem = await getTaxSystem();
    const password = student.dolibarrPassword ?? generateDolibarrPassword(student.username);
    const { entityId } = await createEntity(
      student.companyName ?? `Empresa de ${student.username}`,
      student.username,
      taxSystem,
    );
    const { userId } = await createDolibarrUser(entityId, {
      username: student.username,
      password,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
    });

    await db
      .update(studentsTable)
      .set({
        dolibarrEntityId: entityId,
        dolibarrUserId: userId,
        dolibarrSyncStatus: "synced",
        dolibarrSyncError: null,
        dolibarrPassword: password,
      })
      .where(eq(studentsTable.id, studentId));

    await logActivity({
      action: "deploy_student",
      entityType: "student",
      entityId: studentId,
      entityName: `${student.firstName} ${student.lastName}`,
      details: `Entidad Dolibarr #${entityId} creada`,
    });

    res.json({
      studentId,
      status: "synced",
      entityId,
      dolibarrPassword: password,
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
      status: "error",
      entityId: null,
      dolibarrPassword: null,
      error: message,
    });
  }
});

router.post("/groups/:id/deploy-all", async (req, res) => {
  const groupId = Number(req.params.id);
  if (isNaN(groupId)) {
    res.status(400).json({ error: "ID de grupo inválido" });
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

  if (!isDolibarrConfigured()) {
    res.status(503).json({ error: `Dolibarr no está configurado. ${describeDolibarrConfig()}` });
    return;
  }

  const students = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.groupId, groupId));

  const pending = students.filter(
    (s) => s.dolibarrSyncStatus !== "synced" || !s.dolibarrEntityId,
  );

  let deployed = 0;
  const skipped = students.length - pending.length;
  const errors: { studentId: number; username: string; error: string }[] = [];

  for (const student of pending) {
    try {
      const password = student.dolibarrPassword ?? generateDolibarrPassword(student.username);
      const { entityId } = await createEntity(
        student.companyName ?? `Empresa de ${student.username}`,
        student.username,
      );
      await createDolibarrUser(entityId, {
        username: student.username,
        password,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
      });

      await db
        .update(studentsTable)
        .set({
          dolibarrEntityId: entityId,
          dolibarrSyncStatus: "synced",
          dolibarrSyncError: null,
          dolibarrPassword: password,
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

export default router;
