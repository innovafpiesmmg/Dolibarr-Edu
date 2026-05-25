import { Router, type IRouter } from "express";
import { eq, ne, sql } from "drizzle-orm";
import { db, teachersTable, studentsTable } from "@workspace/db";
import {
  pingNextcloud,
  isNextcloudConfigured,
  createNextcloudUser,
  nextcloudUserExists,
  deleteNextcloudUser,
  generateNcPassword,
} from "../lib/nextcloud";

const router: IRouter = Router();

router.get("/nextcloud/status", async (req, res) => {
  const configured = isNextcloudConfigured();
  if (!configured) {
    res.json({ connected: false, configured: false });
    return;
  }
  const status = await pingNextcloud();
  res.json({ ...status, configured: true });
});

router.get("/nextcloud/users", async (req, res) => {
  const teachers = await db
    .select({
      id: teachersTable.id,
      username: teachersTable.username,
      displayName: sql<string>`${teachersTable.firstName} || ' ' || ${teachersTable.lastName}`,
      email: teachersTable.email,
      nextcloudSyncStatus: teachersTable.nextcloudSyncStatus,
      type: sql<string>`'teacher'`,
    })
    .from(teachersTable);

  const students = await db
    .select({
      id: studentsTable.id,
      username: studentsTable.username,
      displayName: sql<string>`${studentsTable.firstName} || ' ' || ${studentsTable.lastName}`,
      email: studentsTable.email,
      nextcloudSyncStatus: studentsTable.nextcloudSyncStatus,
      type: sql<string>`'student'`,
    })
    .from(studentsTable);

  res.json({ teachers, students });
});

router.post("/nextcloud/provision/all", async (req, res) => {
  if (!isNextcloudConfigured()) {
    res.status(503).json({ error: "Nextcloud no está configurado en el servidor" });
    return;
  }

  const teachers = await db
    .select()
    .from(teachersTable)
    .where(ne(teachersTable.nextcloudSyncStatus, "synced"));

  const students = await db
    .select()
    .from(studentsTable)
    .where(ne(studentsTable.nextcloudSyncStatus, "synced"));

  let provisioned = 0;
  const errors: { username: string; error: string }[] = [];

  for (const teacher of teachers) {
    try {
      const exists = await nextcloudUserExists(teacher.username);
      if (!exists) {
        await createNextcloudUser({
          username: teacher.username,
          password: generateNcPassword(teacher.username),
          displayName: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
        });
      }
      await db
        .update(teachersTable)
        .set({ nextcloudSyncStatus: "synced" })
        .where(eq(teachersTable.id, teacher.id));
      provisioned++;
    } catch (err) {
      await db
        .update(teachersTable)
        .set({ nextcloudSyncStatus: "error" })
        .where(eq(teachersTable.id, teacher.id));
      errors.push({ username: teacher.username, error: (err as Error).message });
    }
  }

  for (const student of students) {
    try {
      const exists = await nextcloudUserExists(student.username);
      if (!exists) {
        await createNextcloudUser({
          username: student.username,
          password: generateNcPassword(student.username),
          displayName: `${student.firstName} ${student.lastName}`,
          email: student.email,
        });
      }
      await db
        .update(studentsTable)
        .set({ nextcloudSyncStatus: "synced" })
        .where(eq(studentsTable.id, student.id));
      provisioned++;
    } catch (err) {
      await db
        .update(studentsTable)
        .set({ nextcloudSyncStatus: "error" })
        .where(eq(studentsTable.id, student.id));
      errors.push({ username: student.username, error: (err as Error).message });
    }
  }

  res.json({ provisioned, errors, total: teachers.length + students.length });
});

router.delete("/nextcloud/users/teachers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [teacher] = await db
    .select({ username: teachersTable.username })
    .from(teachersTable)
    .where(eq(teachersTable.id, id))
    .limit(1);

  if (!teacher) {
    res.status(404).json({ error: "Profesor no encontrado" });
    return;
  }

  await deleteNextcloudUser(teacher.username);
  await db
    .update(teachersTable)
    .set({ nextcloudSyncStatus: "pending" })
    .where(eq(teachersTable.id, id));

  res.status(204).send();
});

router.delete("/nextcloud/users/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [student] = await db
    .select({ username: studentsTable.username })
    .from(studentsTable)
    .where(eq(studentsTable.id, id))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  await deleteNextcloudUser(student.username);
  await db
    .update(studentsTable)
    .set({ nextcloudSyncStatus: "pending" })
    .where(eq(studentsTable.id, id));

  res.status(204).send();
});

export default router;
