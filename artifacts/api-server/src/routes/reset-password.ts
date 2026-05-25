import { Router, type IRouter } from "express";
import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, studentsTable } from "@workspace/db";
import { logActivity } from "../lib/activity";
import { dbName, dbUser, invalidateTokenCache } from "../lib/student-dolibarr";
import { ensureStudentDatabase, isMariaDBConfigured } from "../lib/mariadb";

const router: IRouter = Router();

function generatePassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

router.post("/students/:id/reset-password", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID de alumno inválido" }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  if (!student) { res.status(404).json({ error: "Alumno no encontrado" }); return; }

  const newPassword = generatePassword();
  const newHash = createHash("sha256").update(newPassword).digest("hex");

  await db
    .update(studentsTable)
    .set({ dolibarrPassword: newPassword, passwordHash: newHash })
    .where(eq(studentsTable.id, id));

  let dolibarrUpdated = false;
  let message = "Contraseña del panel actualizada.";

  // En el modelo per-container, el alumno es admin de su propio Dolibarr.
  // La contraseña Dolibarr coincide con la contraseña de la BD MariaDB del
  // alumno. Actualizamos el usuario MariaDB (idempotente vía ALTER USER).
  // El cambio del admin DENTRO de Dolibarr requiere que el alumno la cambie
  // desde su propio panel — o un próximo despliegue lo regenera.
  if (student.dolibarrSyncStatus === "synced" && isMariaDBConfigured()) {
    try {
      await ensureStudentDatabase(dbName(student.username), dbUser(student.username), newPassword);
      invalidateTokenCache(student.username);
      dolibarrUpdated = true;
      message = "Contraseña actualizada en el panel y en la BD MariaDB del alumno. El admin DENTRO de su Dolibarr debe cambiarse manualmente o tras un re-despliegue.";
    } catch (err) {
      message = `Contraseña actualizada en el panel, pero falló MariaDB: ${err instanceof Error ? err.message : "Error"}`;
    }
  }

  await logActivity({
    action: "reset_password",
    entityType: "student",
    entityId: id,
    entityName: `${student.firstName} ${student.lastName}`,
    details: dolibarrUpdated ? "Sincronizado con MariaDB" : "Solo panel",
  });

  res.json({ studentId: id, newPassword, dolibarrUpdated, message });
});

export default router;
