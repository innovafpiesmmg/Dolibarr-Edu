import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, studentsTable, payrollsTable, employeesTable, ssPaymentsTable } from "@workspace/db";
import { isDolibarrConfigured, paySSToBank, payIRPFToBank } from "../lib/dolibarr";

const router: IRouter = Router();

const PeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int(),
});

const PeriodBodySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
});

async function getStudentEntity(studentId: number) {
  const [s] = await db
    .select({ id: studentsTable.id, dolibarrEntityId: studentsTable.dolibarrEntityId })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);
  return s ?? null;
}

async function getPayrollsForPeriod(studentId: number, month: number, year: number) {
  return db
    .select({
      payroll: payrollsTable,
      employee: {
        id: employeesTable.id,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
        jobTitle: employeesTable.jobTitle,
        contractType: employeesTable.contractType,
      },
    })
    .from(payrollsTable)
    .innerJoin(employeesTable, eq(payrollsTable.employeeId, employeesTable.id))
    .where(
      and(
        eq(payrollsTable.studentId, studentId),
        eq(payrollsTable.periodMonth, month),
        eq(payrollsTable.periodYear, year),
      ),
    );
}

// GET /students/:id/ss-summary?month=&year=
router.get("/students/:id/ss-summary", async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { month, year } = PeriodSchema.parse(req.query);

  const student = await getStudentEntity(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  const rows = await getPayrollsForPeriod(studentId, month, year);

  const lines = rows.map(({ payroll: p, employee: e }) => ({
    employeeId: e.id,
    payrollId: p.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    jobTitle: e.jobTitle,
    contractType: e.contractType,
    baseCotizacion: Number(p.baseCotizacion),
    ssTrabajador: Number(p.totalSsTrabajador),
    ssEmpresa: Number(p.totalSsEmpresa),
    totalSS: Number(p.totalSsTrabajador) + Number(p.totalSsEmpresa),
    irpf: Number(p.irpfAmount),
    liquidoPercibir: Number(p.liquidoPercibir),
  }));

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const totalSSTrabajadores = r2(lines.reduce((s, l) => s + l.ssTrabajador, 0));
  const totalSSEmpresa = r2(lines.reduce((s, l) => s + l.ssEmpresa, 0));
  const totalSSIngresar = r2(totalSSTrabajadores + totalSSEmpresa);
  const totalIrpf = r2(lines.reduce((s, l) => s + l.irpf, 0));

  // Comprobar si ya existe un registro de pago para este período
  const [existing] = await db
    .select()
    .from(ssPaymentsTable)
    .where(
      and(
        eq(ssPaymentsTable.studentId, studentId),
        eq(ssPaymentsTable.periodMonth, month),
        eq(ssPaymentsTable.periodYear, year),
      ),
    )
    .limit(1);

  res.json({
    studentId,
    periodMonth: month,
    periodYear: year,
    lines,
    totalSSTrabajadores,
    totalSSEmpresa,
    totalSSIngresar,
    totalIrpf,
    ssPayment: existing
      ? {
          id: existing.id,
          ssStatus: existing.ssStatus,
          irpfStatus: existing.irpfStatus,
          ssDolibarrAccountingId: existing.ssDolibarrAccountingId,
          irpfDolibarrAccountingId: existing.irpfDolibarrAccountingId,
        }
      : null,
  });
});

// POST /students/:id/ss-pay — registra pago SS en Dolibarr: 476 → 572
router.post("/students/:id/ss-pay", async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) { res.status(400).json({ error: "ID inválido" }); return; }

  if (!isDolibarrConfigured()) {
    res.status(503).json({ error: "Dolibarr no está configurado (falta DOLIBARR_API_URL o DOLIBARR_API_KEY)" });
    return;
  }

  const { month, year } = PeriodBodySchema.parse(req.body);

  const student = await getStudentEntity(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  if (!student.dolibarrEntityId) {
    res.status(400).json({ error: "El alumno no tiene empresa en Dolibarr. Despliégala primero." });
    return;
  }

  const rows = await getPayrollsForPeriod(studentId, month, year);
  if (rows.length === 0) {
    res.status(400).json({ error: "No hay nóminas calculadas para este período" });
    return;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const totalSSIngresar = r2(
    rows.reduce((s, { payroll: p }) => s + Number(p.totalSsTrabajador) + Number(p.totalSsEmpresa), 0),
  );

  const { accountingId } = await paySSToBank(student.dolibarrEntityId, {
    periodMonth: month,
    periodYear: year,
    total: totalSSIngresar,
  });

  // Guardar/actualizar registro de pago
  const [existing] = await db
    .select()
    .from(ssPaymentsTable)
    .where(
      and(
        eq(ssPaymentsTable.studentId, studentId),
        eq(ssPaymentsTable.periodMonth, month),
        eq(ssPaymentsTable.periodYear, year),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(ssPaymentsTable)
      .set({ ssStatus: "paid", ssDolibarrAccountingId: accountingId })
      .where(eq(ssPaymentsTable.id, existing.id));
  } else {
    const totalSSTrab = r2(rows.reduce((s, { payroll: p }) => s + Number(p.totalSsTrabajador), 0));
    const totalSSEmp = r2(rows.reduce((s, { payroll: p }) => s + Number(p.totalSsEmpresa), 0));
    const totalIRPF = r2(rows.reduce((s, { payroll: p }) => s + Number(p.irpfAmount), 0));
    await db.insert(ssPaymentsTable).values({
      studentId,
      periodMonth: month,
      periodYear: year,
      totalSsTrabajadores: String(totalSSTrab),
      totalSsEmpresa: String(totalSSEmp),
      totalSSIngresar: String(totalSSIngresar),
      totalIrpf: String(totalIRPF),
      ssStatus: "paid",
      ssDolibarrAccountingId: accountingId,
    });
  }

  res.json({
    accountingId,
    total: totalSSIngresar,
    message: `Asiento contable 476→572 registrado en Dolibarr. Total: ${totalSSIngresar} €`,
  });
});

// POST /students/:id/irpf-pay — registra pago IRPF en Dolibarr: 4751 → 572
router.post("/students/:id/irpf-pay", async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) { res.status(400).json({ error: "ID inválido" }); return; }

  if (!isDolibarrConfigured()) {
    res.status(503).json({ error: "Dolibarr no está configurado (falta DOLIBARR_API_URL o DOLIBARR_API_KEY)" });
    return;
  }

  const { month, year } = PeriodBodySchema.parse(req.body);

  const student = await getStudentEntity(studentId);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }
  if (!student.dolibarrEntityId) {
    res.status(400).json({ error: "El alumno no tiene empresa en Dolibarr. Despliégala primero." });
    return;
  }

  const rows = await getPayrollsForPeriod(studentId, month, year);
  if (rows.length === 0) {
    res.status(400).json({ error: "No hay nóminas calculadas para este período" });
    return;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const totalIRPF = r2(rows.reduce((s, { payroll: p }) => s + Number(p.irpfAmount), 0));

  const { accountingId } = await payIRPFToBank(student.dolibarrEntityId, {
    periodMonth: month,
    periodYear: year,
    total: totalIRPF,
  });

  const [existing] = await db
    .select()
    .from(ssPaymentsTable)
    .where(
      and(
        eq(ssPaymentsTable.studentId, studentId),
        eq(ssPaymentsTable.periodMonth, month),
        eq(ssPaymentsTable.periodYear, year),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(ssPaymentsTable)
      .set({ irpfStatus: "paid", irpfDolibarrAccountingId: accountingId })
      .where(eq(ssPaymentsTable.id, existing.id));
  } else {
    const totalSSTrab = r2(rows.reduce((s, { payroll: p }) => s + Number(p.totalSsTrabajador), 0));
    const totalSSEmp = r2(rows.reduce((s, { payroll: p }) => s + Number(p.totalSsEmpresa), 0));
    const totalSS = r2(totalSSTrab + totalSSEmp);
    await db.insert(ssPaymentsTable).values({
      studentId,
      periodMonth: month,
      periodYear: year,
      totalSsTrabajadores: String(totalSSTrab),
      totalSsEmpresa: String(totalSSEmp),
      totalSSIngresar: String(totalSS),
      totalIrpf: String(totalIRPF),
      irpfStatus: "paid",
      irpfDolibarrAccountingId: accountingId,
    });
  }

  res.json({
    accountingId,
    total: totalIRPF,
    message: `Asiento contable 4751→572 registrado en Dolibarr. Modelo 111: ${totalIRPF} €`,
  });
});

export default router;
