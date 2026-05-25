import { Router, type IRouter } from "express";
import { eq, ilike, sql, or, and } from "drizzle-orm";
import { db, groupsTable, teachersTable, studentsTable } from "@workspace/db";
import {
  ListGroupsQueryParams,
  CreateGroupBody,
  GetGroupParams,
  UpdateGroupBody,
  UpdateGroupParams,
  DeleteGroupParams,
  ListGroupStudentsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const groupWithTeacherQuery = (whereClause?: ReturnType<typeof eq>) =>
  db
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
    .where(whereClause)
    .groupBy(groupsTable.id, teachersTable.firstName, teachersTable.lastName);

router.get("/groups", async (req, res) => {
  const query = ListGroupsQueryParams.parse(req.query);
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  let whereClause;
  if (query.teacherId && query.search) {
    whereClause = and(
      eq(groupsTable.teacherId, query.teacherId),
      or(
        ilike(groupsTable.name, `%${query.search}%`),
        ilike(groupsTable.courseYear, `%${query.search}%`),
      ),
    );
  } else if (query.teacherId) {
    whereClause = eq(groupsTable.teacherId, query.teacherId);
  } else if (query.search) {
    whereClause = or(
      ilike(groupsTable.name, `%${query.search}%`),
      ilike(groupsTable.courseYear, `%${query.search}%`),
    );
  }

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
    .where(whereClause)
    .groupBy(groupsTable.id, teachersTable.firstName, teachersTable.lastName)
    .limit(limit)
    .offset(offset);

  res.json(groups);
});

router.post("/groups", async (req, res) => {
  const body = CreateGroupBody.parse(req.body);

  const teacher = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.id, body.teacherId))
    .limit(1);

  if (teacher.length === 0) {
    res.status(400).json({ error: "El profesor indicado no existe" });
    return;
  }

  const [group] = await db
    .insert(groupsTable)
    .values({
      name: body.name,
      courseYear: body.courseYear,
      description: body.description ?? null,
      teacherId: body.teacherId,
    })
    .returning();

  const [row] = await groupWithTeacherQuery(eq(groupsTable.id, group.id));
  res.status(201).json(row);
});

router.get("/groups/:id", async (req, res) => {
  const { id } = GetGroupParams.parse(req.params);

  const [row] = await groupWithTeacherQuery(eq(groupsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Grupo no encontrado" });
    return;
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
      companyName: studentsTable.companyName,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, studentsTable.groupId))
    .where(eq(studentsTable.groupId, id));

  res.json({ ...row, students });
});

router.patch("/groups/:id", async (req, res) => {
  const { id } = UpdateGroupParams.parse(req.params);
  const body = UpdateGroupBody.parse(req.body);

  if (body.teacherId !== undefined) {
    const teacher = await db
      .select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.id, body.teacherId))
      .limit(1);
    if (teacher.length === 0) {
      res.status(400).json({ error: "El profesor indicado no existe" });
      return;
    }
  }

  const [updated] = await db
    .update(groupsTable)
    .set({
      ...(body.name && { name: body.name }),
      ...(body.courseYear && { courseYear: body.courseYear }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.teacherId !== undefined && { teacherId: body.teacherId }),
    })
    .where(eq(groupsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Grupo no encontrado" });
    return;
  }

  const [row] = await groupWithTeacherQuery(eq(groupsTable.id, id));
  res.json(row);
});

router.delete("/groups/:id", async (req, res) => {
  const { id } = DeleteGroupParams.parse(req.params);

  const studentsInGroup = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.groupId, id))
    .limit(1);

  if (studentsInGroup.length > 0) {
    res.status(400).json({ error: "No se puede eliminar: el grupo tiene alumnos asignados" });
    return;
  }

  const [deleted] = await db
    .delete(groupsTable)
    .where(eq(groupsTable.id, id))
    .returning({ id: groupsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Grupo no encontrado" });
    return;
  }

  res.status(204).send();
});

router.get("/groups/:id/students", async (req, res) => {
  const { id } = ListGroupStudentsParams.parse(req.params);

  const students = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      email: studentsTable.email,
      username: studentsTable.username,
      groupId: studentsTable.groupId,
      groupName: sql<string>`${groupsTable.name}`,
      companyName: studentsTable.companyName,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .innerJoin(groupsTable, eq(groupsTable.id, studentsTable.groupId))
    .where(eq(studentsTable.groupId, id));

  res.json(students);
});

export default router;
