import { createHmac, timingSafeEqual } from "crypto";

export function adminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH ?? "";
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-secret-change-me";
}

export function generateAdminToken(): string {
  return createHmac("sha256", sessionSecret())
    .update(adminPasswordHash())
    .digest("hex");
}

// ── Tokens de profesor ───────────────────────────────────────────────────────
// Token: hex(HMAC(secret, "teacher:<id>:<passwordHash>"))).<id>
// Verificable sin estado: recalculamos la firma con el hash actual del profe.

export function generateTeacherToken(teacherId: number, passwordHash: string): string {
  const sig = createHmac("sha256", sessionSecret())
    .update(`teacher:${teacherId}:${passwordHash}`)
    .digest("hex");
  return `${sig}.${teacherId}`;
}

export function parseTeacherToken(token: string): { teacherId: number; signature: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [signature, idStr] = parts;
  const id = parseInt(idStr, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;
  return { teacherId: id, signature };
}

export function verifyTeacherSignature(teacherId: number, passwordHash: string, signature: string): boolean {
  const expected = createHmac("sha256", sessionSecret())
    .update(`teacher:${teacherId}:${passwordHash}`)
    .digest("hex");
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
