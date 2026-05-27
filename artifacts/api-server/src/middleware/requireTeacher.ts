import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, teachersTable } from "@workspace/db";
import type { Teacher } from "@workspace/db/schema";
import { parseTeacherToken, verifyTeacherSignature } from "../lib/auth";

export type TeacherRequest = Request & { teacher: Teacher };

export async function requireTeacher(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "No autenticado" });
    return;
  }

  const parsed = parseTeacherToken(header.slice(7));
  if (!parsed) {
    res.status(401).json({ message: "Token inválido" });
    return;
  }

  const [teacher] = await db
    .select()
    .from(teachersTable)
    .where(eq(teachersTable.id, parsed.teacherId))
    .limit(1);

  if (!teacher) {
    res.status(401).json({ message: "Profesor no encontrado" });
    return;
  }

  if (!verifyTeacherSignature(teacher.id, teacher.passwordHash, parsed.signature)) {
    res.status(401).json({ message: "Token inválido" });
    return;
  }

  (req as TeacherRequest).teacher = teacher;
  next();
}
