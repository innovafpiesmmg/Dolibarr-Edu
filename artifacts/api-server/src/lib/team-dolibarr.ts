// Helpers para subdominios, naming y deploy de equipos colaborativos.
// MODELO: cada equipo tiene su PROPIO contenedor Dolibarr + BD aislados.
//   - El admin del Dolibarr del equipo es el PROFESOR del grupo (entra con su
//     usuario+contraseña del panel, las mismas que ya tiene en su Dolibarr propio).
//   - Los miembros del equipo son usuarios Dolibarr no-admin creados en el
//     contenedor del equipo (NO en el del profesor).
//   - Subdominio del equipo: `equipo-<letra>-<grupoSlug>.<baseDomain>`.
//   - Contenedor + BD: `dolibarr_eqp_<grupoSlug>_<letra>` / `doli_eqp_<grupoSlug>_<letra>`.
import { logger } from "./logger";
import type { DolibarrConfig } from "./dolibarr";

export function teamSlug(groupSlug: string, letter: string): string {
  const safeGroup = sanitizeGroupSlug(groupSlug);
  const safeLetter = sanitizeLetter(letter);
  return `equipo-${safeLetter}-${safeGroup}`;
}

function sanitizeGroupSlug(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function sanitizeLetter(l: string): string {
  return (l || "x").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "x";
}

// ── Naming determinista del contenedor + BD del equipo ──────────────────────
// El "id" interno del equipo en docker/mariadb usa `_` (no `-`) para cumplir
// las restricciones de MariaDB (identificadores) y Docker (nombres de cont.).
function teamIdentifier(groupSlug: string, letter: string): string {
  return `${sanitizeGroupSlug(groupSlug).replace(/-/g, "_")}_${sanitizeLetter(letter)}`;
}

export function teamContainerName(groupSlug: string, letter: string): string {
  return `dolibarr_eqp_${teamIdentifier(groupSlug, letter)}`;
}

export function teamDbName(groupSlug: string, letter: string): string {
  return `doli_eqp_${teamIdentifier(groupSlug, letter)}`.slice(0, 64);
}

export function teamDbUser(groupSlug: string, letter: string): string {
  // MariaDB limita usuarios a 32 chars.
  return `doli_eqp_${teamIdentifier(groupSlug, letter)}`.slice(0, 32);
}

export function teamInternalUrl(groupSlug: string, letter: string): string {
  return `http://${teamContainerName(groupSlug, letter)}`;
}

export function publicHostname(groupSlug: string, letter: string, baseDomain: string): string {
  return `${teamSlug(groupSlug, letter)}.${baseDomain}`;
}

export function publicUrl(groupSlug: string, letter: string, baseDomain: string): string {
  return `https://${publicHostname(groupSlug, letter, baseDomain)}`;
}

export function groupNameToSlug(groupName: string): string {
  return groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

// Letra correlativa: A, B, C... a partir de un conjunto de letras ya usadas.
export function nextLetter(used: string[]): string {
  const set = new Set(used.map((l) => l.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!set.has(l)) return l;
  }
  throw new Error("No quedan letras libres (>26 equipos por grupo)");
}

// ── Token cache para llamadas API panel→Dolibarr-del-equipo ─────────────────
const tokenCache = new Map<string, { token: string; expiry: number }>();

async function loginToTeamDolibarr(baseUrl: string, login: string, password: string): Promise<string> {
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
    throw new Error(`Login Dolibarr equipo (${baseUrl}) fallido: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string; success?: { token?: string } };
  const token = data.token ?? data.success?.token;
  if (!token) throw new Error(`Dolibarr login equipo: respuesta sin token (${baseUrl})`);

  tokenCache.set(cacheKey, { token, expiry: Date.now() + 3_600_000 });
  logger.info({ baseUrl }, "Token Dolibarr equipo obtenido y cacheado");
  return token;
}

export function invalidateTeamTokenCache(groupSlug: string, letter: string): void {
  const baseUrl = teamInternalUrl(groupSlug, letter);
  for (const k of tokenCache.keys()) {
    if (k.startsWith(`${baseUrl}::`)) tokenCache.delete(k);
  }
}

// El admin del Dolibarr del equipo es el PROFESOR (usa sus mismas credenciales
// que en su Dolibarr propio). Por eso recibimos teacherUsername + teacherPassword.
export async function getTeamDolibarrConfig(args: {
  groupSlug: string;
  letter: string;
  teacherUsername: string;
  teacherPassword: string | null;
}): Promise<DolibarrConfig> {
  if (!args.teacherPassword) {
    throw new Error(
      `Equipo ${args.letter}/${args.groupSlug}: el profesor no tiene dolibarrPassword. Despliega su Dolibarr individual primero (es necesario aunque el equipo viva en su propio contenedor — usamos sus mismas credenciales como admin).`,
    );
  }
  const baseUrl = teamInternalUrl(args.groupSlug, args.letter);
  const apiKey = await loginToTeamDolibarr(baseUrl, args.teacherUsername, args.teacherPassword);
  return { apiUrl: baseUrl, apiKey };
}
