import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, payrollsTable, employeesTable, studentsTable } from "@workspace/db";
import { z } from "zod";
import { calculatePayroll } from "../lib/payroll-calculator";
import { createDolibarrSalary, createPayrollAccountingEntry } from "../lib/dolibarr";
import { getStudentDolibarrConfig } from "../lib/student-dolibarr";

const router: IRouter = Router();

const PayrollInputSchema = z.object({
  employeeId: z.number().int(),
  studentId: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int(),
  plusConvenio: z.number().default(0),
  plusTransporte: z.number().default(0),
  importeHorasExtra: z.number().default(0),
  otroDevengo: z.number().default(0),
  otroDevengoLabel: z.string().optional(),
  irpfRateOverride: z.number().min(0).max(45).optional(),
});

async function getEmployeeAndStudent(employeeId: number, studentId: number) {
  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.studentId, studentId)))
    .limit(1);
  if (!emp) return null;

  const [student] = await db
    .select({
      username: studentsTable.username,
      dolibarrSyncStatus: studentsTable.dolibarrSyncStatus,
      dolibarrPassword: studentsTable.dolibarrPassword,
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);

  return { employee: emp, student: student ?? null };
}

function toDto(p: typeof payrollsTable.$inferSelect) {
  return {
    id: p.id,
    employeeId: p.employeeId,
    studentId: p.studentId,
    periodMonth: p.periodMonth,
    periodYear: p.periodYear,
    salaryBase: Number(p.salaryBase),
    plusConvenio: Number(p.plusConvenio),
    plusTransporte: Number(p.plusTransporte),
    importeHorasExtra: Number(p.importeHorasExtra),
    otroDevengo: Number(p.otroDevengo),
    otroDevengoLabel: p.otroDevengoLabel,
    prorataPagasExtra: Number(p.prorataPagasExtra),
    totalDevengos: Number(p.totalDevengos),
    baseCotizacion: Number(p.baseCotizacion),
    ssContingencias: Number(p.ssContingencias),
    ssDesempleo: Number(p.ssDesempleo),
    ssFp: Number(p.ssFp),
    totalSsTrabajador: Number(p.totalSsTrabajador),
    irpfRate: Number(p.irpfRate),
    irpfAmount: Number(p.irpfAmount),
    totalDeducciones: Number(p.totalDeducciones),
    liquidoPercibir: Number(p.liquidoPercibir),
    ssEmpresaContingencias: Number(p.ssEmpresaContingencias),
    ssEmpresaDesempleo: Number(p.ssEmpresaDesempleo),
    ssEmpresaFp: Number(p.ssEmpresaFp),
    ssEmpresaFogasa: Number(p.ssEmpresaFogasa),
    totalSsEmpresa: Number(p.totalSsEmpresa),
    totalCosteEmpresa: Number(p.totalCosteEmpresa),
    dolibarrSalaryId: p.dolibarrSalaryId,
    dolibarrAccountingId: p.dolibarrAccountingId,
    dolibarrSyncStatus: p.dolibarrSyncStatus,
    dolibarrSyncError: p.dolibarrSyncError,
    createdAt: p.createdAt,
  };
}

router.post("/payrolls/calculate", async (req, res) => {
  const body = PayrollInputSchema.parse(req.body);
  const row = await getEmployeeAndStudent(body.employeeId, body.studentId);
  if (!row) {
    res.status(404).json({ error: "Trabajador no encontrado o no pertenece al alumno indicado" });
    return;
  }

  const result = calculatePayroll({
    ...body,
    salaryBase: Number(row.employee.salaryBase),
    extraPayments: row.employee.extraPayments,
    contractType: row.employee.contractType as "indefinido" | "temporal",
    irpfRate: Number(row.employee.irpfRate),
  });

  res.json(result);
});

router.get("/payrolls", async (req, res) => {
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;

  let whereClause;
  if (studentId && employeeId) {
    whereClause = and(eq(payrollsTable.studentId, studentId), eq(payrollsTable.employeeId, employeeId));
  } else if (studentId) {
    whereClause = eq(payrollsTable.studentId, studentId);
  } else if (employeeId) {
    whereClause = eq(payrollsTable.employeeId, employeeId);
  }

  const payrolls = await db
    .select()
    .from(payrollsTable)
    .where(whereClause)
    .orderBy(payrollsTable.periodYear, payrollsTable.periodMonth);

  res.json(payrolls.map(toDto));
});

router.post("/payrolls", async (req, res) => {
  const body = PayrollInputSchema.parse(req.body);
  const row = await getEmployeeAndStudent(body.employeeId, body.studentId);
  if (!row) {
    res.status(404).json({ error: "Trabajador no encontrado o no pertenece al alumno indicado" });
    return;
  }

  const calc = calculatePayroll({
    ...body,
    salaryBase: Number(row.employee.salaryBase),
    extraPayments: row.employee.extraPayments,
    contractType: row.employee.contractType as "indefinido" | "temporal",
    irpfRate: Number(row.employee.irpfRate),
  });

  const s = (n: number) => String(n);

  const [payroll] = await db
    .insert(payrollsTable)
    .values({
      studentId: calc.studentId,
      employeeId: calc.employeeId,
      periodMonth: calc.periodMonth,
      periodYear: calc.periodYear,
      salaryBase: s(calc.salaryBase),
      plusConvenio: s(calc.plusConvenio),
      plusTransporte: s(calc.plusTransporte),
      importeHorasExtra: s(calc.importeHorasExtra),
      otroDevengo: s(calc.otroDevengo),
      otroDevengoLabel: calc.otroDevengoLabel,
      prorataPagasExtra: s(calc.prorataPagasExtra),
      totalDevengos: s(calc.totalDevengos),
      baseCotizacion: s(calc.baseCotizacion),
      ssContingencias: s(calc.ssContingencias),
      ssDesempleo: s(calc.ssDesempleo),
      ssFp: s(calc.ssFp),
      totalSsTrabajador: s(calc.totalSsTrabajador),
      irpfRate: s(calc.irpfRate),
      irpfAmount: s(calc.irpfAmount),
      totalDeducciones: s(calc.totalDeducciones),
      liquidoPercibir: s(calc.liquidoPercibir),
      ssEmpresaContingencias: s(calc.ssEmpresaContingencias),
      ssEmpresaDesempleo: s(calc.ssEmpresaDesempleo),
      ssEmpresaFp: s(calc.ssEmpresaFp),
      ssEmpresaFogasa: s(calc.ssEmpresaFogasa),
      totalSsEmpresa: s(calc.totalSsEmpresa),
      totalCosteEmpresa: s(calc.totalCosteEmpresa),
      dolibarrSyncStatus: "pending",
    })
    .returning();

  // Integración directa con el Dolibarr del alumno si está desplegado
  const studentReady =
    row.student?.dolibarrSyncStatus === "synced" &&
    !!row.student.dolibarrPassword &&
    !!row.employee.dolibarrEmployeeId;

  if (studentReady && row.student) {
    const employeeName = `${row.employee.firstName} ${row.employee.lastName}`;
    let salaryId: number | undefined;
    let accountingId: number | undefined;
    let syncError: string | undefined;

    try {
      const config = await getStudentDolibarrConfig(row.student);
      try {
        const { salaryId: sid } = await createDolibarrSalary(config, {
          dolibarrEmployeeId: row.employee.dolibarrEmployeeId!,
          label: `Nómina ${employeeName} ${String(calc.periodMonth).padStart(2, "0")}/${calc.periodYear}`,
          periodMonth: calc.periodMonth,
          periodYear: calc.periodYear,
          totalDevengos: calc.totalDevengos,
          totalDeducciones: calc.totalDeducciones,
          liquidoPercibir: calc.liquidoPercibir,
        });
        salaryId = sid;
      } catch (err) {
        syncError = `Salario: ${err instanceof Error ? err.message : "Error"}`;
      }

      try {
        const { accountingId: aid } = await createPayrollAccountingEntry(config, {
          periodMonth: calc.periodMonth,
          periodYear: calc.periodYear,
          employeeName,
          totalDevengos: calc.totalDevengos,
          ssEmpresa: calc.totalSsEmpresa,
          liquidoPercibir: calc.liquidoPercibir,
          totalSsTrabajador: calc.totalSsTrabajador,
          irpfAmount: calc.irpfAmount,
        });
        accountingId = aid;
      } catch (err) {
        const msg = `Contabilidad: ${err instanceof Error ? err.message : "Error"}`;
        syncError = syncError ? `${syncError} | ${msg}` : msg;
      }
    } catch (err) {
      syncError = `Conexión: ${err instanceof Error ? err.message : "Error"}`;
    }

    const [updated] = await db
      .update(payrollsTable)
      .set({
        dolibarrSalaryId: salaryId ?? null,
        dolibarrAccountingId: accountingId ?? null,
        dolibarrSyncStatus: syncError ? "error" : "synced",
        dolibarrSyncError: syncError ?? null,
      })
      .where(eq(payrollsTable.id, payroll.id))
      .returning();

    res.status(201).json(toDto(updated));
    return;
  }

  res.status(201).json(toDto(payroll));
});

router.get("/payrolls/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [payroll] = await db.select().from(payrollsTable).where(eq(payrollsTable.id, id)).limit(1);
  if (!payroll) { res.status(404).json({ error: "Nómina no encontrada" }); return; }
  res.json(toDto(payroll));
});

router.delete("/payrolls/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [deleted] = await db
    .delete(payrollsTable)
    .where(eq(payrollsTable.id, id))
    .returning({ id: payrollsTable.id });
  if (!deleted) { res.status(404).json({ error: "Nómina no encontrada" }); return; }
  res.status(204).send();
});

export default router;
