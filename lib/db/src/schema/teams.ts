import { pgTable, serial, timestamp, varchar, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groupsTable } from "./groups";

export const teamsTable = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
    letter: varchar("letter", { length: 2 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    dolibarrSyncStatus: varchar("dolibarr_sync_status", { length: 20 }).notNull().default("pending"),
    dolibarrSyncError: varchar("dolibarr_sync_error", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("teams_group_letter_uniq").on(t.groupId, t.letter)],
);

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
