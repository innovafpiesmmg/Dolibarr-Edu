import { pgTable, serial, integer, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { employeesTable } from "./employees";

export const payrollsTable = pgTable("payrolls", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  // Devengos
  salaryBase: numeric("salary_base", { precision: 10, scale: 2 }).notNull(),
  plusConvenio: numeric("plus_convenio", { precision: 10, scale: 2 }).notNull().default("0"),
  plusTransporte: numeric("plus_transporte", { precision: 10, scale: 2 }).notNull().default("0"),
  importeHorasExtra: numeric("importe_horas_extra", { precision: 10, scale: 2 }).notNull().default("0"),
  otroDevengo: numeric("otro_devengo", { precision: 10, scale: 2 }).notNull().default("0"),
  otroDevengoLabel: varchar("otro_devengo_label", { length: 100 }),
  prorataPagasExtra: numeric("prorrata_pagas_extra", { precision: 10, scale: 2 }).notNull().default("0"),
  totalDevengos: numeric("total_devengos", { precision: 10, scale: 2 }).notNull(),
  // SS trabajador
  baseCotizacion: numeric("base_cotizacion", { precision: 10, scale: 2 }).notNull(),
  ssContingencias: numeric("ss_contingencias", { precision: 10, scale: 2 }).notNull(),
  ssDesempleo: numeric("ss_desempleo", { precision: 10, scale: 2 }).notNull(),
  ssFp: numeric("ss_fp", { precision: 10, scale: 2 }).notNull(),
  totalSsTrabajador: numeric("total_ss_trabajador", { precision: 10, scale: 2 }).notNull(),
  // IRPF
  irpfRate: numeric("irpf_rate", { precision: 5, scale: 2 }).notNull(),
  irpfAmount: numeric("irpf_amount", { precision: 10, scale: 2 }).notNull(),
  // Resultado
  totalDeducciones: numeric("total_deducciones", { precision: 10, scale: 2 }).notNull(),
  liquidoPercibir: numeric("liquido_percibir", { precision: 10, scale: 2 }).notNull(),
  // Coste empresa
  ssEmpresaContingencias: numeric("ss_empresa_contingencias", { precision: 10, scale: 2 }).notNull(),
  ssEmpresaDesempleo: numeric("ss_empresa_desempleo", { precision: 10, scale: 2 }).notNull(),
  ssEmpresaFp: numeric("ss_empresa_fp", { precision: 10, scale: 2 }).notNull(),
  ssEmpresaFogasa: numeric("ss_empresa_fogasa", { precision: 10, scale: 2 }).notNull(),
  totalSsEmpresa: numeric("total_ss_empresa", { precision: 10, scale: 2 }).notNull(),
  totalCosteEmpresa: numeric("total_coste_empresa", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Payroll = typeof payrollsTable.$inferSelect;
