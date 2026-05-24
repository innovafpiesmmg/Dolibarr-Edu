import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, activityLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/activity", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;

  let query = db
    .select()
    .from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit);

  if (entityType) {
    query = db
      .select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.entityType, entityType))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit) as typeof query;
  }

  const entries = await query;
  res.json(entries);
});

export default router;
