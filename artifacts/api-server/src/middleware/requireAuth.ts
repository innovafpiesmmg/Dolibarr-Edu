import { Request, Response, NextFunction } from "express";
import { adminPasswordHash, generateAdminToken } from "../lib/auth";

// Rutas públicas (sin auth admin requerida).
// Las rutas /teacher/* tienen su propio middleware (requireTeacher).
const PUBLIC_EXACT = ["/auth/login", "/auth/student-login", "/auth/teacher-login", "/healthz"];
const PUBLIC_PREFIX = ["/teacher/"];

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!adminPasswordHash()) {
    next();
    return;
  }

  if (PUBLIC_EXACT.some((p) => req.path === p)) {
    next();
    return;
  }
  if (PUBLIC_PREFIX.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "No autenticado" });
    return;
  }

  const token = header.slice(7);
  if (token !== generateAdminToken()) {
    res.status(401).json({ message: "Token inválido" });
    return;
  }

  next();
}
