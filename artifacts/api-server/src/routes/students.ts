import { Router, type IRouter } from "express";
import { eq, ilike, sql, or, and } from "drizzle-orm";
import { db, studentsTable, groupsTable, teachersTable } from "@workspace/db";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  CreateStudentsBulkBody,
  GetStudentParams,
  UpdateStudentBody,
  UpdateStudentParams,
  DeleteStudentParams,
} from "@workspace/api-zod";
import { createHash } from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

const studentWithGroupQuery = (whereClause?: ReturnType<typeof eq>) =>
  db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      email: studentsTable.email,
      username: studentsTable.username,
      groupId: studentsTable.groupId,
      groupName: sql<string>`${groupsTable.name}`,
      dolibarrSyncStatus: studentsTable.dolibarrSyncStatus,
      dolibarrSyncError: studentsTable.dolibarrSyncError,
      dolibarrPassword: studentsTable.dolibarrPassword,
      companyName: studentsTable.companyName,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, studentsTable.groupId))
    .where(whereClause);

router.get("/students", async (req, res) => {
  const query = ListStudentsQueryParams.parse(req.query);
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  let whereClause;
  if (query.groupId && query.search) {
    whereClause = and(
      eq(studentsTable.groupId, query.groupId),
      or(
        ilike(studentsTable.firstName, `%${query.search}%`),
        ilike(studentsTable.lastName, `%${query.search}%`),
        ilike(studentsTable.email, `%${query.search}%`),
        ilike(studentsTable.username, `%${query.search}%`),
      ),
    );
  } else if (query.groupId) {
    whereClause = eq(studentsTable.groupId, query.groupId);
  } else if (query.search) {
    whereClause = or(
      ilike(studentsTable.firstName, `%${query.search}%`),
      ilike(studentsTable.lastName, `%${query.search}%`),
      ilike(studentsTable.email, `%${query.search}%`),
      ilike(studentsTable.username, `%${query.search}%`),
    );
  }

  const students = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      email: studentsTable.email,
      username: studentsTable.username,
      groupId: studentsTable.groupId,
      groupName: sql<string>`${groupsTable.name}`,
      dolibarrSyncStatus: studentsTable.dolibarrSyncStatus,
      dolibarrSyncError: studentsTable.dolibarrSyncError,
      dolibarrPassword: studentsTable.dolibarrPassword,
      companyName: studentsTable.companyName,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, studentsTable.groupId))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  res.json(students);
});

router.post("/students/bulk", async (req, res) => {
  const body = CreateStudentsBulkBody.parse(req.body);

  const group = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.id, body.groupId))
    .limit(1);

  if (group.length === 0) {
    res.status(400).json({ error: "El grupo indicado no existe" });
    return;
  }

  let created = 0;
  const errors: { username: string; error: string }[] = [];

  for (const student of body.students) {
    try {
      const existing = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(
          or(
            eq(studentsTable.email, student.email),
            eq(studentsTable.username, student.username),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        errors.push({ username: student.username, error: "Email o usuario ya existe" });
        continue;
      }

      await db.insert(studentsTable).values({
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        username: student.username,
        passwordHash: hashPassword(student.password),
        dolibarrPassword: student.password,
        groupId: body.groupId,
        companyName: student.companyName ?? null,
      });
      created++;
    } catch (err) {
      errors.push({ username: student.username, error: "Error interno al crear el alumno" });
    }
  }

  res.json({ created, errors });
});

router.post("/students", async (req, res) => {
  const body = CreateStudentBody.parse(req.body);

  const group = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(eq(groupsTable.id, body.groupId))
    .limit(1);

  if (group.length === 0) {
    res.status(400).json({ error: "El grupo indicado no existe" });
    return;
  }

  const existing = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(
      or(
        eq(studentsTable.email, body.email),
        eq(studentsTable.username, body.username),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "El email o nombre de usuario ya existe" });
    return;
  }

  const [student] = await db
    .insert(studentsTable)
    .values({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      username: body.username,
      passwordHash: hashPassword(body.password),
      dolibarrPassword: body.password,
      groupId: body.groupId,
      companyName: body.companyName ?? null,
    })
    .returning();

  const [row] = await studentWithGroupQuery(eq(studentsTable.id, student.id));
  res.status(201).json(row);
});

router.get("/students/:id", async (req, res) => {
  const { id } = GetStudentParams.parse(req.params);

  const [row] = await studentWithGroupQuery(eq(studentsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  res.json(row);
});

router.patch("/students/:id", async (req, res) => {
  const { id } = UpdateStudentParams.parse(req.params);
  const body = UpdateStudentBody.parse(req.body);

  if (body.groupId !== undefined) {
    const group = await db
      .select({ id: groupsTable.id })
      .from(groupsTable)
      .where(eq(groupsTable.id, body.groupId))
      .limit(1);
    if (group.length === 0) {
      res.status(400).json({ error: "El grupo indicado no existe" });
      return;
    }
  }

  const [updated] = await db
    .update(studentsTable)
    .set({
      ...(body.firstName && { firstName: body.firstName }),
      ...(body.lastName && { lastName: body.lastName }),
      ...(body.email && { email: body.email }),
      ...(body.groupId !== undefined && { groupId: body.groupId }),
      ...(body.companyName !== undefined && { companyName: body.companyName }),
    })
    .where(eq(studentsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  const [row] = await studentWithGroupQuery(eq(studentsTable.id, id));
  res.json(row);
});

router.delete("/students/:id", async (req, res) => {
  const { id } = DeleteStudentParams.parse(req.params);

  const [toDelete] = await db
    .select({ id: studentsTable.id, username: studentsTable.username })
    .from(studentsTable)
    .where(eq(studentsTable.id, id))
    .limit(1);

  if (!toDelete) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  await db.delete(studentsTable).where(eq(studentsTable.id, id));

  res.status(204).send();
});

export default router;
