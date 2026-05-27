import { createHash } from "crypto";
import { logger } from "./logger";
import type { DolibarrConfig } from "./dolibarr";

// ── Convención de naming determinista por alumno ────────────────────────────
// Cada alumno tiene su propio contenedor Dolibarr + base de datos. Los nombres
// se derivan del username para que sean reproducibles sin almacenarlos en BD.
//
// `username` se asume ya validado (único + minLength 3) por el endpoint de
// creación de alumnos. Aquí sólo lo normalizamos para que sea seguro como
// identificador Docker / MariaDB / DNS.

export function sanitize(username: string): string {
  // Identificador para contenedor / BD / usuario MariaDB:
  // [a-z0-9_], max 40 chars (deja margen para prefijos).
  return username.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
}

export function subdomainSlug(username: string): string {
  // Subdominio DNS válido: [a-z0-9-], no empieza/termina en `-`, max 40 chars.
  // Usamos `-` en vez de `_` porque los guiones bajos no son válidos en
  // hostnames públicos según RFC 1123.
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function containerName(username: string): string {
  return `dolibarr_alu_${sanitize(username)}`;
}

export function dbName(username: string): string {
  return `doli_${sanitize(username)}`;
}

export function dbUser(username: string): string {
  // Usuarios MariaDB limitados a 32 caracteres
  return `doli_${sanitize(username)}`.slice(0, 32);
}

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET no configurada (o demasiado corta). Necesaria para derivar contraseñas deterministas del Dolibarr de cada alumno.",
    );
  }
  return s;
}

export function deterministicPassword(username: string, salt = "dolibarr"): string {
  return createHash("sha256")
    .update(`${salt}:${username}:${sessionSecret()}`)
    .digest("hex")
    .slice(0, 24);
}

export function publicHostname(username: string, baseDomain: string): string {
  return `${subdomainSlug(username)}.${baseDomain}`;
}

export function publicUrl(username: string, baseDomain: string): string {
  return `https://${publicHostname(username, baseDomain)}`;
}

export function internalUrl(username: string): string {
  // El panel_api habla con el Dolibarr del alumno por red Docker interna,
  // por nombre de contenedor.
  return `http://${containerName(username)}`;
}

// ── Resolución de DolibarrConfig por alumno ─────────────────────────────────
// Cada llamada API panel→Dolibarr-del-alumno necesita una URL base + token.
// El token se obtiene con login admin/password en el primer uso.

const tokenCache = new Map<string, { token: string; expiry: number }>();

async function loginToStudentDolibarr(baseUrl: string, login: string, password: string): Promise<string> {
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
    throw new Error(`Login Dolibarr (${baseUrl}) fallido: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string; success?: { token?: string } };
  const token = data.token ?? data.success?.token;
  if (!token) throw new Error(`Dolibarr login: respuesta sin token (${baseUrl})`);

  tokenCache.set(cacheKey, { token, expiry: Date.now() + 3_600_000 });
  logger.info({ baseUrl }, "Token Dolibarr alumno obtenido y cacheado");
  return token;
}

export function invalidateTokenCache(username: string): void {
  const baseUrl = internalUrl(username);
  for (const k of tokenCache.keys()) {
    if (k.startsWith(`${baseUrl}::`)) tokenCache.delete(k);
  }
}

export async function getStudentDolibarrConfig(student: {
  username: string;
  dolibarrPassword: string | null;
}): Promise<DolibarrConfig> {
  if (!student.dolibarrPassword) {
    throw new Error(`Alumno ${student.username}: sin contraseña Dolibarr. Despliega su contenedor primero.`);
  }
  const baseUrl = internalUrl(student.username);
  const apiKey = await loginToStudentDolibarr(baseUrl, student.username, student.dolibarrPassword);
  return { apiUrl: baseUrl, apiKey };
}
