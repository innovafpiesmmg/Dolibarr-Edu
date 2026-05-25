import { Router, type IRouter } from "express";
import { eq, ilike, sql, or } from "drizzle-orm";
import { db, teachersTable, groupsTable, studentsTable } from "@workspace/db";
import {
  ListTeachersQueryParams,
  CreateTeacherBody,
  GetTeacherParams,
  UpdateTeacherBody,
  UpdateTeacherParams,
  DeleteTeacherParams,
  ListTeacherGroupsParams,
} from "@workspace/api-zod";
import { createHash } from "crypto";
import {
  isNextcloudConfigured,
  createNextcloudUser,
  deleteNextcloudUser,
  generateNcPassword,
} from "../lib/nextcloud";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

router.get("/teachers", async (req, res) => {
  const query = ListTeachersQueryParams.parse(req.query);
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const whereClause = query.search
    ? or(
        ilike(teachersTable.firstName, `%${query.search}%`),
        ilike(teachersTable.lastName, `%${query.search}%`),
        ilike(teachersTable.email, `%${query.search}%`),
        ilike(teachersTable.username, `%${query.search}%`),
      )
    : undefined;

  const teachers = await db
    .select({
      id: teachersTable.id,
      firstName: teachersTable.firstName,
      lastName: teachersTable.lastName,
      email: teachersTable.email,
      username: teachersTable.username,
      phone: teachersTable.phone,
      createdAt: teachersTable.createdAt,
      groupCount: sql<number>`count(distinct ${groupsTable.id})::int`,
      studentCount: sql<number>`count(distinct ${studentsTable.id})::int`,
    })
    .from(teachersTable)
    .leftJoin(groupsTable, eq(groupsTable.teacherId, teachersTable.id))
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(whereClause)
    .groupBy(teachersTable.id)
    .limit(limit)
    .offset(offset);

  res.json(teachers);
});

router.post("/teachers", async (req, res) => {
  const body = CreateTeacherBody.parse(req.body);

  const existing = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(
      or(
        eq(teachersTable.email, body.email),
        eq(teachersTable.username, body.username),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "El email o nombre de usuario ya existe" });
    return;
  }

  const [teacher] = await db
    .insert(teachersTable)
    .values({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      username: body.username,
      passwordHash: hashPassword(body.password),
      phone: body.phone ?? null,
    })
    .returning();

  // Fire-and-forget Nextcloud provisioning
  if (isNextcloudConfigured()) {
    void createNextcloudUser({
      username: teacher.username,
      password: generateNcPassword(teacher.username),
      displayName: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
    })
      .then(() =>
        db
          .update(teachersTable)
          .set({ nextcloudSyncStatus: "synced" })
          .where(eq(teachersTable.id, teacher.id)),
      )
      .catch(() =>
        db
          .update(teachersTable)
          .set({ nextcloudSyncStatus: "error" })
          .where(eq(teachersTable.id, teacher.id)),
      );
  }

  res.status(201).json({
    ...teacher,
    groupCount: 0,
    studentCount: 0,
  });
});

router.get("/teachers/:id", async (req, res) => {
  const { id } = GetTeacherParams.parse(req.params);

  const [row] = await db
    .select({
      id: teachersTable.id,
      firstName: teachersTable.firstName,
      lastName: teachersTable.lastName,
      email: teachersTable.email,
      username: teachersTable.username,
      phone: teachersTable.phone,
      createdAt: teachersTable.createdAt,
      groupCount: sql<number>`count(distinct ${groupsTable.id})::int`,
      studentCount: sql<number>`count(distinct ${studentsTable.id})::int`,
    })
    .from(teachersTable)
    .leftJoin(groupsTable, eq(groupsTable.teacherId, teachersTable.id))
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(teachersTable.id, id))
    .groupBy(teachersTable.id);

  if (!row) {
    res.status(404).json({ error: "Profesor no encontrado" });
    return;
  }

  res.json(row);
});

router.patch("/teachers/:id", async (req, res) => {
  const { id } = UpdateTeacherParams.parse(req.params);
  const body = UpdateTeacherBody.parse(req.body);

  const [updated] = await db
    .update(teachersTable)
    .set({
      ...(body.firstName && { firstName: body.firstName }),
      ...(body.lastName && { lastName: body.lastName }),
      ...(body.email && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
    })
    .where(eq(teachersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Profesor no encontrado" });
    return;
  }

  const [row] = await db
    .select({
      id: teachersTable.id,
      firstName: teachersTable.firstName,
      lastName: teachersTable.lastName,
      email: teachersTable.email,
      username: teachersTable.username,
      phone: teachersTable.phone,
      createdAt: teachersTable.createdAt,
      groupCount: sql<number>`count(distinct ${groupsTable.id})::int`,
      studentCount: sql<number>`count(distinct ${studentsTable.id})::int`,
    })
    .from(teachersTable)
    .leftJoin(groupsTable, eq(groupsTable.teacherId, teachersTable.id))
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(teachersTable.id, id))
    .groupBy(teachersTable.id);

  res.json(row);
});

router.delete("/teachers/:id", async (req, res) => {
  const { id } = DeleteTeacherParams.parse(req.params);

  const groupsUsing = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.teacherId, id))
    .limit(1);

  if (groupsUsing.length > 0) {
    res.status(400).json({ error: "No se puede eliminar: el profesor tiene grupos asignados" });
    return;
  }

  const [toDelete] = await db
    .select({ id: teachersTable.id, username: teachersTable.username })
    .from(teachersTable)
    .where(eq(teachersTable.id, id))
    .limit(1);

  if (!toDelete) {
    res.status(404).json({ error: "Profesor no encontrado" });
    return;
  }

  await db.delete(teachersTable).where(eq(teachersTable.id, id));

  // Fire-and-forget Nextcloud cleanup
  if (isNextcloudConfigured()) {
    void deleteNextcloudUser(toDelete.username);
  }

  res.status(204).send();
});

router.get("/teachers/:id/groups", async (req, res) => {
  const { id } = ListTeacherGroupsParams.parse(req.params);

  const groups = await db
    .select({
      id: groupsTable.id,
      name: groupsTable.name,
      courseYear: groupsTable.courseYear,
      description: groupsTable.description,
      teacherId: groupsTable.teacherId,
      teacherName: sql<string>`${teachersTable.firstName} || ' ' || ${teachersTable.lastName}`,
      studentCount: sql<number>`count(${studentsTable.id})::int`,
      createdAt: groupsTable.createdAt,
    })
    .from(groupsTable)
    .innerJoin(teachersTable, eq(teachersTable.id, groupsTable.teacherId))
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(groupsTable.teacherId, id))
    .groupBy(groupsTable.id, teachersTable.firstName, teachersTable.lastName);

  res.json(groups);
});

export default router;
