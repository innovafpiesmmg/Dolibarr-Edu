import { Request, Response, NextFunction } from "express";
import { adminPasswordHash, generateAdminToken } from "../lib/auth";

const PUBLIC = ["/auth/login", "/auth/student-login", "/healthz"];

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!adminPasswordHash()) {
    next();
    return;
  }

  if (PUBLIC.some((p) => req.path === p || req.path.startsWith(p + "/"))) {
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
