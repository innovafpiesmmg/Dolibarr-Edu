import { Router } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { studentsTable, groupsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { AdminLoginBody, StudentLoginBody, TeacherLoginBody } from "@workspace/api-zod";
import { teachersTable, teamsTable } from "@workspace/db/schema";
import { adminPasswordHash, generateAdminToken, generateTeacherToken } from "../lib/auth";
import {
  publicUrl,
  deterministicPassword,
  containerName as studentContainerName,
  dbName as studentDbName,
} from "../lib/student-dolibarr";
import {
  containerName as teacherContainerName,
  dbName as teacherDbName,
} from "../lib/teacher-dolibarr";
import { publicUrl as teamPublicUrl, groupNameToSlug } from "../lib/team-dolibarr";
import { getBaseDomain } from "./settings";
import { disableCsrfInConfPhp, isDockerAvailable } from "../lib/docker";
import { relaxStudentSecurityForSso, isMariaDBConfigured } from "../lib/mariadb";
import { logger } from "../lib/logger";

// Auto-cura contenedores ya desplegados antes de la era del fix CSRF:
// reaplica los overrides en `conf.php` (define NOCSRFCHECK) y en `llx_const`
// (MAIN_SECURITY_CSRF_WITH_TOKEN=0). Best-effort, no bloquea la respuesta.
function autoHealCsrf(container: string, dbname: string): void {
  if (isDockerAvailable()) {
    disableCsrfInConfPhp(container).catch((err) =>
      logger.warn({ err, container }, "auto-heal CSRF conf.php falló"),
    );
  }
  if (isMariaDBConfigured()) {
    relaxStudentSecurityForSso(dbname).catch((err) =>
      logger.warn({ err, dbname }, "auto-heal CSRF llx_const falló"),
    );
  }
}

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

  // Si el alumno está en un equipo, redirigir al Dolibarr del equipo (contenedor del profe)
  // y usar las credenciales personales del alumno creadas dentro de ese contenedor.
  const [fullStudent] = await db
    .select({
      teamId: studentsTable.teamId,
      groupName: groupsTable.name,
    })
    .from(studentsTable)
    .leftJoin(groupsTable, eq(studentsTable.groupId, groupsTable.id))
    .where(eq(studentsTable.id, student.id))
    .limit(1);

  if (fullStudent?.teamId && baseDomain) {
    const [team] = await db
      .select({ letter: teamsTable.letter, groupName: groupsTable.name })
      .from(teamsTable)
      .leftJoin(groupsTable, eq(teamsTable.groupId, groupsTable.id))
      .where(eq(teamsTable.id, fullStudent.teamId))
      .limit(1);

    if (team) {
      const groupSlug = groupNameToSlug(team.groupName ?? "");
      const teamUrl = teamPublicUrl(groupSlug, team.letter, baseDomain);
      // Auto-heal CSRF en el contenedor del PROFESOR (host del Dolibarr de equipo).
      // Necesitamos su username; lo buscamos a partir del groupId del alumno.
      const [grp] = await db
        .select({ teacherUsername: teachersTable.username })
        .from(groupsTable)
        .innerJoin(teachersTable, eq(teachersTable.id, groupsTable.teacherId))
        .where(eq(groupsTable.id, (await db
          .select({ groupId: studentsTable.groupId })
          .from(studentsTable)
          .where(eq(studentsTable.id, student.id))
          .limit(1))[0]?.groupId ?? 0))
        .limit(1);
      if (grp?.teacherUsername) {
        autoHealCsrf(teacherContainerName(grp.teacherUsername), teacherDbName(grp.teacherUsername));
      }
      // La contraseña del Dolibarr de equipo se guardó en students.dolibarrPassword
      // cuando se aprovisionó el usuario dentro del contenedor del profesor.
      // Si por algún motivo no hay (provisión fallida), devolvemos cadena vacía:
      // el alumno verá la URL pero no podrá hacer autologin hasta que se reintente.
      res.json({
        firstName: student.firstName,
        lastName: student.lastName,
        companyName: student.companyName ?? null,
        groupName: student.groupName ?? "",
        dolibarrUrl: teamUrl,
        dolibarrUsername: student.username,
        dolibarrPassword: student.dolibarrPassword ?? "",
        mode: "team" as const,
        teamLetter: team.letter,
        teamName: `Equipo ${team.letter}`,
      });
      return;
    }
  }

  const deployed = baseDomain && student.dolibarrSyncStatus === "synced";
  if (deployed) {
    autoHealCsrf(studentContainerName(student.username), studentDbName(student.username));
  }
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
    dolibarrUsername: deployed ? student.username : "",
    dolibarrPassword,
    mode: "individual" as const,
    teamLetter: null,
    teamName: null,
  });
});

// POST /auth/teacher-login — profesor accede a su panel de supervisión
router.post("/auth/teacher-login", async (req, res) => {
  const parsed = TeacherLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Usuario y contraseña requeridos" });
    return;
  }

  const inputHash = createHash("sha256").update(parsed.data.password).digest("hex");

  const [teacher] = await db
    .select()
    .from(teachersTable)
    .where(eq(teachersTable.username, parsed.data.username))
    .limit(1);

  if (!teacher || teacher.passwordHash !== inputHash) {
    res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    return;
  }

  res.json({
    token: generateTeacherToken(teacher.id, teacher.passwordHash),
    teacher: {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      username: teacher.username,
    },
  });
});

export default router;
