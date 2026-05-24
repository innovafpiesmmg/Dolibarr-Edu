import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, employeesTable, studentsTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import {
  isDolibarrConfigured,
  createDolibarrEmployee,
} from "../lib/dolibarr";

const router: IRouter = Router();

router.get("/employees", async (req, res) => {
  const { studentId } = ListEmployeesQueryParams.parse(req.query);

  const [student] = await db
    .select({ id: studentsTable.id, dolibarrEntityId: studentsTable.dolibarrEntityId })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  const employees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.studentId, studentId));

  res.json(employees.map(toDto));
});

router.post("/employees", async (req, res) => {
  const body = CreateEmployeeBody.parse(req.body);

  const [student] = await db
    .select({ id: studentsTable.id, dolibarrEntityId: studentsTable.dolibarrEntityId })
    .from(studentsTable)
    .where(eq(studentsTable.id, body.studentId))
    .limit(1);

  if (!student) {
    res.status(400).json({ error: "Alumno no encontrado" });
    return;
  }

  const [employee] = await db
    .insert(employeesTable)
    .values({
      studentId: body.studentId,
      firstName: body.firstName,
      lastName: body.lastName,
      dni: body.dni ?? null,
      jobTitle: body.jobTitle,
      contractType: body.contractType ?? "indefinido",
      groupCategory: body.groupCategory ?? 7,
      salaryBase: String(body.salaryBase),
      extraPayments: body.extraPayments ?? 14,
      irpfRate: String(body.irpfRate ?? 15),
      dolibarrSyncStatus: "pending",
    })
    .returning();

  // Sincronización directa con Dolibarr si está configurado y la empresa está desplegada
  if (isDolibarrConfigured() && student.dolibarrEntityId) {
    try {
      const { employeeId: dolibarrEmpId } = await createDolibarrEmployee(
        student.dolibarrEntityId,
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          jobTitle: employee.jobTitle,
          contractType: employee.contractType as "indefinido" | "temporal",
          salaryBase: Number(employee.salaryBase),
          dni: employee.dni,
        },
      );

      const [synced] = await db
        .update(employeesTable)
        .set({ dolibarrEmployeeId: dolibarrEmpId, dolibarrSyncStatus: "synced", dolibarrSyncError: null })
        .where(eq(employeesTable.id, employee.id))
        .returning();

      res.status(201).json(toDto(synced));
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      const [updated] = await db
        .update(employeesTable)
        .set({ dolibarrSyncStatus: "error", dolibarrSyncError: msg })
        .where(eq(employeesTable.id, employee.id))
        .returning();
      // Devolvemos el empleado creado (localmente) pero con el error de sync
      res.status(201).json(toDto(updated));
      return;
    }
  }

  res.status(201).json(toDto(employee));
});

router.get("/employees/:id", async (req, res) => {
  const { id } = GetEmployeeParams.parse(req.params);

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, id))
    .limit(1);

  if (!employee) {
    res.status(404).json({ error: "Trabajador no encontrado" });
    return;
  }

  res.json(toDto(employee));
});

router.put("/employees/:id", async (req, res) => {
  const { id } = UpdateEmployeeParams.parse(req.params);
  const body = CreateEmployeeBody.parse(req.body);

  const [updated] = await db
    .update(employeesTable)
    .set({
      firstName: body.firstName,
      lastName: body.lastName,
      dni: body.dni ?? null,
      jobTitle: body.jobTitle,
      contractType: body.contractType ?? "indefinido",
      groupCategory: body.groupCategory ?? 7,
      salaryBase: String(body.salaryBase),
      extraPayments: body.extraPayments ?? 14,
      irpfRate: String(body.irpfRate ?? 15),
    })
    .where(eq(employeesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Trabajador no encontrado" });
    return;
  }

  res.json(toDto(updated));
});

router.delete("/employees/:id", async (req, res) => {
  const { id } = DeleteEmployeeParams.parse(req.params);

  const [deleted] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, id))
    .returning({ id: employeesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Trabajador no encontrado" });
    return;
  }

  res.status(204).send();
});

function toDto(e: typeof employeesTable.$inferSelect) {
  return {
    id: e.id,
    studentId: e.studentId,
    firstName: e.firstName,
    lastName: e.lastName,
    dni: e.dni,
    jobTitle: e.jobTitle,
    contractType: e.contractType,
    groupCategory: e.groupCategory,
    salaryBase: Number(e.salaryBase),
    extraPayments: e.extraPayments,
    irpfRate: Number(e.irpfRate),
    active: e.active,
    dolibarrEmployeeId: e.dolibarrEmployeeId,
    dolibarrSyncStatus: e.dolibarrSyncStatus,
    dolibarrSyncError: e.dolibarrSyncError,
    createdAt: e.createdAt,
  };
}

export default router;
