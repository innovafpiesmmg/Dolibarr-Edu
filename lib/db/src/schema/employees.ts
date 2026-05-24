import { pgTable, serial, integer, varchar, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dni: varchar("dni", { length: 20 }),
  jobTitle: varchar("job_title", { length: 100 }).notNull(),
  contractType: varchar("contract_type", { length: 20 }).notNull().default("indefinido"),
  groupCategory: integer("group_category").notNull().default(7),
  salaryBase: numeric("salary_base", { precision: 10, scale: 2 }).notNull(),
  extraPayments: integer("extra_payments").notNull().default(14),
  irpfRate: numeric("irpf_rate", { precision: 5, scale: 2 }).notNull().default("15"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Employee = typeof employeesTable.$inferSelect;
