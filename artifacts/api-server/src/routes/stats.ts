import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, teachersTable, groupsTable, studentsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (_req, res) => {
  const [totals] = await db
    .select({
      totalTeachers: sql<number>`(select count(*) from ${teachersTable})::int`,
      totalGroups: sql<number>`(select count(*) from ${groupsTable})::int`,
      totalStudents: sql<number>`(select count(*) from ${studentsTable})::int`,
    })
    .from(teachersTable)
    .limit(1);

  const studentsPerGroup = await db
    .select({
      groupId: groupsTable.id,
      groupName: groupsTable.name,
      count: sql<number>`count(${studentsTable.id})::int`,
    })
    .from(groupsTable)
    .leftJoin(studentsTable, eq(studentsTable.groupId, groupsTable.id))
    .groupBy(groupsTable.id, groupsTable.name)
    .orderBy(groupsTable.name);

  res.json({
    totalTeachers: totals?.totalTeachers ?? 0,
    totalGroups: totals?.totalGroups ?? 0,
    totalStudents: totals?.totalStudents ?? 0,
    studentsPerGroup,
  });
});

export default router;
