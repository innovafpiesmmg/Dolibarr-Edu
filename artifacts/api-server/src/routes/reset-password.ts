import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, studentsTable } from "@workspace/db";
import {
  generateDolibarrPassword,
  updateDolibarrUserPassword,
  isDolibarrConfigured,
} from "../lib/dolibarr";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

router.post("/students/:id/reset-password", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID de alumno inválido" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, id))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Alumno no encontrado" });
    return;
  }

  const newPassword = generateDolibarrPassword(student.username);
  const newHash = createHash("sha256").update(newPassword).digest("hex");

  await db
    .update(studentsTable)
    .set({
      dolibarrPassword: newPassword,
      passwordHash: newHash,
    })
    .where(eq(studentsTable.id, id));

  let dolibarrUpdated = false;
  let message = "Contraseña actualizada en la base de datos.";

  if (
    isDolibarrConfigured() &&
    student.dolibarrUserId &&
    student.dolibarrEntityId
  ) {
    try {
      await updateDolibarrUserPassword(
        student.dolibarrUserId,
        student.dolibarrEntityId,
        newPassword,
      );
      dolibarrUpdated = true;
      message = "Contraseña actualizada en la base de datos y en Dolibarr.";
    } catch (err) {
      message = `Contraseña actualizada en BD, pero falló la sincronización con Dolibarr: ${String(err)}`;
    }
  }

  await logActivity({
    action: "reset_password",
    entityType: "student",
    entityId: id,
    entityName: `${student.firstName} ${student.lastName}`,
    details: dolibarrUpdated ? "Sincronizado con Dolibarr" : "Solo en BD",
  });

  res.json({ studentId: id, newPassword, dolibarrUpdated, message });
});

export default router;
