import { createHash } from "crypto";
import { logger } from "./logger";
import type { DolibarrConfig } from "./dolibarr";

// ── Convención de naming determinista por profesor ──────────────────────────
// Mismo patrón que `student-dolibarr.ts` pero con prefijo `prof` para
// distinguir contenedores/BDs/subdominios de los de alumnos.

export function sanitize(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
}

export function subdomainSlug(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function containerName(username: string): string {
  return `dolibarr_prof_${sanitize(username)}`;
}

export function dbName(username: string): string {
  return `doli_prof_${sanitize(username)}`;
}

export function dbUser(username: string): string {
  return `doli_prof_${sanitize(username)}`.slice(0, 32);
}

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET no configurada (o demasiado corta). Necesaria para derivar contraseñas deterministas del Dolibarr del profesor.",
    );
  }
  return s;
}

export function deterministicPassword(username: string, salt = "dolibarr-prof"): string {
  return createHash("sha256")
    .update(`${salt}:${username}:${sessionSecret()}`)
    .digest("hex")
    .slice(0, 24);
}

export function publicHostname(username: string, baseDomain: string): string {
  return `prof-${subdomainSlug(username)}.${baseDomain}`;
}

export function publicUrl(username: string, baseDomain: string): string {
  return `https://${publicHostname(username, baseDomain)}`;
}

export function internalUrl(username: string): string {
  return `http://${containerName(username)}`;
}

const tokenCache = new Map<string, { token: string; expiry: number }>();

async function loginToTeacherDolibarr(baseUrl: string, login: string, password: string): Promise<string> {
  const cacheKey = `${baseUrl}::${login}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.token;

  const qs = new URLSearchParams({ login, password }).toString();
  const res = await fetch(`${baseUrl}/api/index.php/login?${qs}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Login Dolibarr profesor (${baseUrl}) fallido: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string; success?: { token?: string } };
  const token = data.token ?? data.success?.token;
  if (!token) throw new Error(`Dolibarr login profesor: respuesta sin token (${baseUrl})`);

  tokenCache.set(cacheKey, { token, expiry: Date.now() + 3_600_000 });
  logger.info({ baseUrl }, "Token Dolibarr profesor obtenido y cacheado");
  return token;
}

export function invalidateTokenCache(username: string): void {
  const baseUrl = internalUrl(username);
  for (const k of tokenCache.keys()) {
    if (k.startsWith(`${baseUrl}::`)) tokenCache.delete(k);
  }
}

export async function getTeacherDolibarrConfig(teacher: {
  username: string;
  dolibarrPassword: string | null;
}): Promise<DolibarrConfig> {
  if (!teacher.dolibarrPassword) {
    throw new Error(`Profesor ${teacher.username}: sin contraseña Dolibarr. Despliega su contenedor primero.`);
  }
  const baseUrl = internalUrl(teacher.username);
  const apiKey = await loginToTeacherDolibarr(baseUrl, "admin", teacher.dolibarrPassword);
  return { apiUrl: baseUrl, apiKey };
}
