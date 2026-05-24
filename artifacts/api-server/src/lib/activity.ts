import { db, activityLogsTable } from "@workspace/db";

export async function logActivity(opts: {
  action: string;
  entityType: string;
  entityId?: number;
  entityName: string;
  details?: string;
}): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      entityName: opts.entityName,
      details: opts.details ?? null,
    });
  } catch {
    // El log de actividad es no-crítico — no propagamos errores
  }
}
