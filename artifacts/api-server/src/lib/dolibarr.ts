import { logger } from "./logger";

export interface DolibarrConfig {
  apiUrl: string;
  apiKey: string;
}

export interface CreatedEntity {
  entityId: number;
}

export interface CreatedUser {
  userId: number;
}

function getConfig(): DolibarrConfig | null {
  const apiUrl = process.env.DOLIBARR_API_URL;
  const apiKey = process.env.DOLIBARR_API_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

export function isDolibarrConfigured(): boolean {
  return getConfig() !== null;
}

async function dolibarrFetch(
  config: DolibarrConfig,
  path: string,
  options: RequestInit & { entityId?: number } = {},
): Promise<Response> {
  const { entityId, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    DOLAPIKEY: config.apiKey,
    ...(entityId !== undefined ? { DOLENTITY: String(entityId) } : {}),
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  const url = `${config.apiUrl}/api/index.php${path}`;
  const res = await fetch(url, { ...fetchOptions, headers });
  return res;
}

export async function createEntity(companyName: string, username: string): Promise<CreatedEntity> {
  const config = getConfig();
  if (!config) throw new Error("Dolibarr no está configurado (falta DOLIBARR_API_URL o DOLIBARR_API_KEY)");

  const body = JSON.stringify({
    label: companyName || `Empresa de ${username}`,
    description: `Empresa simulada FP — alumno: ${username}`,
    country_id: 4,
    active: 1,
  });

  const res = await dolibarrFetch(config, "/multicompany/entities", {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, "Error al crear entidad en Dolibarr");
    throw new Error(`Dolibarr respondió con ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as unknown;
  const entityId = typeof data === "number" ? data : (data as { id: number }).id;
  if (!entityId) throw new Error("Dolibarr no devolvió un ID de entidad válido");

  return { entityId };
}

export async function createDolibarrUser(
  entityId: number,
  opts: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    email: string;
  },
): Promise<CreatedUser> {
  const config = getConfig();
  if (!config) throw new Error("Dolibarr no está configurado");

  const body = JSON.stringify({
    login: opts.username,
    pass: opts.password,
    firstname: opts.firstName,
    lastname: opts.lastName,
    email: opts.email,
    entity: entityId,
    admin: 0,
    statut: 1,
  });

  const res = await dolibarrFetch(config, "/users", {
    method: "POST",
    body,
    entityId,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text, entityId }, "Error al crear usuario en Dolibarr");
    throw new Error(`Error al crear usuario Dolibarr: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json() as unknown;
  const userId = typeof data === "number" ? data : (data as { id: number }).id;
  if (!userId) throw new Error("Dolibarr no devolvió un ID de usuario válido");

  return { userId };
}

export function generateDolibarrPassword(username: string): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  const base = `${username}-`;
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return base + suffix;
}
