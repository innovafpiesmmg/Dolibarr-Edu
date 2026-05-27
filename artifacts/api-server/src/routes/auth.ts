import { Router } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { studentsTable, groupsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { AdminLoginBody, StudentLoginBody } from "@workspace/api-zod";
import { adminPasswordHash, generateAdminToken } from "../lib/auth";
import { publicUrl, deterministicPassword } from "../lib/student-dolibarr";
import { getBaseDomain } from "./settings";

const router = Router();

// POST /auth/login — panel admin login
router.post("/auth/login", async (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Contraseña requerida" });
    return;
  }

  const storedHash = adminPasswordHash();
  if (!storedHash) {
    res.json({ token: "unconfigured" });
    return;
  }

  const inputHash = createHash("sha256").update(parsed.data.password).digest("hex");

  let valid = false;
  try {
    const a = Buffer.from(inputHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    res.status(401).json({ message: "Contraseña incorrecta" });
    return;
  }

  res.json({ token: generateAdminToken() });
});

// POST /auth/student-login — alumno accede a su Dolibarr propio
router.post("/auth/student-login", async (req, res) => {
  const parsed = StudentLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Usuario y contraseña requeridos" });
    return;
  }

  const inputHash = createHash("sha256").update(parsed.data.password).digest("hex");

  const rows = await db
    .select({
      id: studentsTable.id,
      firstName: studentsTable.firstName,
      lastName: studentsTable.lastName,
      username: studentsTable.username,
      companyName: studentsTable.companyName,
      passwordHash: studentsTable.passwordHash,
      dolibarrSyncStatus: studentsTable.dolibarrSyncStatus,
      dolibarrPassword: studentsTable.dolibarrPassword,
      groupName: groupsTable.name,
    })
    .from(studentsTable)
    .leftJoin(groupsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(studentsTable.username, parsed.data.username))
    .limit(1);

  const student = rows[0];
  if (!student || student.passwordHash !== inputHash) {
    res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    return;
  }

  const baseDomain = await getBaseDomain();
  const deployed = baseDomain && student.dolibarrSyncStatus === "synced";
  const dolibarrUrl = deployed ? publicUrl(student.username, baseDomain) : "";
  const dolibarrPassword = deployed
    ? (student.dolibarrPassword ?? deterministicPassword(student.username))
    : "";

  res.json({
    firstName: student.firstName,
    lastName: student.lastName,
    companyName: student.companyName ?? null,
    groupName: student.groupName ?? "",
    dolibarrUrl,
    dolibarrUsername: deployed ? "admin" : "",
    dolibarrPassword,
  });
});

export default router;
