import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const ssPaymentsTable = pgTable("ss_payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  totalSsTrabajadores: numeric("total_ss_trabajadores", { precision: 10, scale: 2 }).notNull(),
  totalSsEmpresa: numeric("total_ss_empresa", { precision: 10, scale: 2 }).notNull(),
  totalSSIngresar: numeric("total_ss_ingresar", { precision: 10, scale: 2 }).notNull(),
  totalIrpf: numeric("total_irpf", { precision: 10, scale: 2 }).notNull(),
  ssDolibarrAccountingId: integer("ss_dolibarr_accounting_id"),
  irpfDolibarrAccountingId: integer("irpf_dolibarr_accounting_id"),
  ssStatus: varchar("ss_status", { length: 20 }).notNull().default("pending"),
  irpfStatus: varchar("irpf_status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SSPayment = typeof ssPaymentsTable.$inferSelect;
