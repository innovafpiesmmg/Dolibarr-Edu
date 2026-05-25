import { logger } from "./logger";

export interface DolibarrConfig {
  apiUrl: string;
  apiKey: string;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string | null {
  const url = process.env.DOLIBARR_API_URL ?? process.env.DOLIBARR_BASE_URL ?? null;
  return url ? url.replace(/\/$/, "") : null;
}

export function isDolibarrConfigured(): boolean {
  const hasUrl = !!getBaseUrl();
  const hasKey = !!process.env.DOLIBARR_API_KEY;
  const hasCreds = !!(process.env.DOLI_ADMIN_LOGIN && process.env.DOLI_ADMIN_PASSWORD);
  return hasUrl && (hasKey || hasCreds);
}

export function describeDolibarrConfig(): string {
  const missing: string[] = [];
  if (!getBaseUrl()) missing.push("DOLIBARR_BASE_URL");
  if (!process.env.DOLIBARR_API_KEY) {
    if (!process.env.DOLI_ADMIN_LOGIN) missing.push("DOLI_ADMIN_LOGIN");
    if (!process.env.DOLI_ADMIN_PASSWORD) missing.push("DOLI_ADMIN_PASSWORD");
  }
  if (missing.length === 0) return "Configuración OK.";
  return `Faltan variables de entorno en panel_api: ${missing.join(", ")}. Revisa el fichero .env del servidor y ejecuta update.sh.`;
}

async function resolveApiKey(baseUrl: string): Promise<string> {
  const staticKey = process.env.DOLIBARR_API_KEY;
  if (staticKey) return staticKey;

  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const login = process.env.DOLI_ADMIN_LOGIN;
  const password = process.env.DOLI_ADMIN_PASSWORD;
  if (!login || !password) {
    throw new Error("Dolibarr no configurado: falta DOLIBARR_API_KEY o credenciales de admin (DOLI_ADMIN_LOGIN/DOLI_ADMIN_PASSWORD)");
  }

  const qs = new URLSearchParams({ login, password }).toString();
  const res = await fetch(`${baseUrl}/api/index.php/login?${qs}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Login Dolibarr fallido: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { token?: string; success?: { token?: string } };
  const token = data.token ?? data.success?.token;
  if (!token) throw new Error("Dolibarr login: no se recibió token en la respuesta");

  cachedToken = token;
  tokenExpiry = Date.now() + 3_600_000;
  logger.info("Token de Dolibarr obtenido y cacheado");
  return token;
}

async function getConfig(): Promise<DolibarrConfig | null> {
  const apiUrl = getBaseUrl();
  if (!apiUrl) return null;

  try {
    const apiKey = await resolveApiKey(apiUrl);
    return { apiUrl, apiKey };
  } catch (err) {
    logger.error({ err }, "No se pudo obtener configuración de Dolibarr");
    return null;
  }
}

async function dolibarrFetch(
  config: DolibarrConfig,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  // Single-entity Dolibarr: no necesitamos DOLENTITY header. El módulo
  // MultiCompany fue descontinuado por el autor — usamos un único Dolibarr
  // donde cada alumno está representado por un "tercero" (societe).
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    DOLAPIKEY: config.apiKey,
    ...(options.headers as Record<string, string> ?? {}),
  };
  const url = `${config.apiUrl}/api/index.php${path}`;
  return fetch(url, { ...options, headers });
}

async function parseId(res: Response, context: string): Promise<number> {
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, `Dolibarr error: ${context}`);
    throw new Error(`${context}: ${res.status} — ${text.slice(0, 200)}`);
  }
  const data = await res.json() as unknown;
  const id = typeof data === "number" ? data : (data as { id: number }).id;
  if (!id) throw new Error(`${context}: respuesta sin ID`);
  return id;
}

// ── Company / Tercero (single-entity, sin MultiCompany) ───────────────────────
//
// Cada alumno se materializa en Dolibarr como un "tercero" (societe), que
// representa su empresa simulada. El nombre histórico `entityId` se mantiene
// en la API para evitar migraciones, pero el valor real es ahora el ID del
// tercero (socid) en `llx_societe`.

export type TaxSystem = "iva" | "igic";

export async function createEntity(
  companyName: string,
  username: string,
  taxSystem: TaxSystem = "igic",
): Promise<{ entityId: number }> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr. Comprueba la URL y las credenciales en Configuración.");

  // IGIC (Canarias): el tercero NO está sujeto a IVA pero sí a IGIC (localtax1).
  // IVA (Península): sujeto a IVA estándar, sin localtax.
  const taxFields =
    taxSystem === "igic"
      ? { tva_assuj: 0, localtax1_assuj: 1, localtax2_assuj: 0 }
      : { tva_assuj: 1, localtax1_assuj: 0, localtax2_assuj: 0 };

  // Cliente Y proveedor a la vez (typent_id=2 = empresa) — el alumno debe poder
  // facturar a clientes y recibir facturas de proveedores en su empresa simulada.
  const res = await dolibarrFetch(config, "/thirdparties", {
    method: "POST",
    body: JSON.stringify({
      name: companyName || `Empresa de ${username}`,
      name_alias: `ALU-${username}`,
      client: 1,
      fournisseur: 1,
      country_id: 4,
      typent_id: 2,
      status: 1,
      note_private: `Empresa simulada FP — alumno: ${username}`,
      ...taxFields,
    }),
  });

  return { entityId: await parseId(res, "createEntity") };
}

export async function createDolibarrUser(
  thirdpartyId: number,
  opts: { username: string; password: string; firstName: string; lastName: string; email: string },
): Promise<{ userId: number }> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  const res = await dolibarrFetch(config, "/users", {
    method: "POST",
    body: JSON.stringify({
      login: opts.username,
      pass: opts.password,
      firstname: opts.firstName,
      lastname: opts.lastName,
      email: opts.email,
      fk_soc: thirdpartyId,
      admin: 0,
      statut: 1,
    }),
  });

  return { userId: await parseId(res, "createDolibarrUser") };
}

export async function updateDolibarrUserPassword(
  userId: number,
  _thirdpartyId: number,
  newPassword: string,
): Promise<void> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  await dolibarrFetch(config, `/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ pass: newPassword }),
  });
}

export function generateDolibarrPassword(username: string): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${username}-${suffix}`;
}

// ── HRM — Empleados ───────────────────────────────────────────────────────────

export async function createDolibarrEmployee(
  thirdpartyId: number,
  opts: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    contractType: "indefinido" | "temporal";
    salaryBase: number;
    dni?: string | null;
  },
): Promise<{ employeeId: number }> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  // En single-entity Dolibarr usamos `fk_soc` para vincular el empleado a la
  // empresa simulada (tercero) del alumno, así filtramos por alumno en listados.
  const res = await dolibarrFetch(config, "/hrm/employees", {
    method: "POST",
    body: JSON.stringify({
      firstname: opts.firstName,
      lastname: opts.lastName,
      job: opts.jobTitle,
      contract_type: opts.contractType === "indefinido" ? 1 : 2,
      salary: opts.salaryBase,
      ref_number: opts.dni ?? "",
      fk_soc: thirdpartyId,
      statut: 1,
    }),
  });

  return { employeeId: await parseId(res, "createDolibarrEmployee") };
}

// ── Salary record ─────────────────────────────────────────────────────────────

export async function createDolibarrSalary(
  thirdpartyId: number,
  opts: {
    dolibarrEmployeeId: number;
    label: string;
    periodMonth: number;
    periodYear: number;
    totalDevengos: number;
    totalDeducciones: number;
    liquidoPercibir: number;
  },
): Promise<{ salaryId: number }> {
  void thirdpartyId; // El tercero se vincula vía el empleado (fk_user→fk_soc).
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-01`;

  const res = await dolibarrFetch(config, "/salaries", {
    method: "POST",
    body: JSON.stringify({
      label: opts.label,
      fk_user: opts.dolibarrEmployeeId,
      datesp: dateStr,
      dateep: dateStr,
      amount: opts.liquidoPercibir,
      note_public: `Devengos: ${opts.totalDevengos} € | Deducciones: ${opts.totalDeducciones} € | Líquido: ${opts.liquidoPercibir} €`,
    }),
  });

  return { salaryId: await parseId(res, "createDolibarrSalary") };
}

// ── Accounting entry ──────────────────────────────────────────────────────────

export async function paySSToBank(
  thirdpartyId: number,
  opts: { periodMonth: number; periodYear: number; total: number; studentRef?: string },
): Promise<{ accountingId: number }> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-28`;
  // Prefijo [ALU-<ref>#<socid>] para trazabilidad por alumno en asientos compartidos.
  const tag = `[ALU-${opts.studentRef ?? "?"}#${thirdpartyId}]`;
  const label = `${tag} Pago SS Tesorería — ${String(opts.periodMonth).padStart(2, "0")}/${opts.periodYear}`;

  const res = await dolibarrFetch(config, "/accountancy/bookkeeping", {
    method: "POST",
    body: JSON.stringify({
      label,
      date_document: dateStr,
      journal_code: "BQ",
      lines: [
        { accountno: "476", label, debit: opts.total, credit: 0 },
        { accountno: "572", label, debit: 0, credit: opts.total },
      ],
    }),
  });

  return { accountingId: await parseId(res, "paySSToBank") };
}

export async function payIRPFToBank(
  thirdpartyId: number,
  opts: { periodMonth: number; periodYear: number; total: number; studentRef?: string },
): Promise<{ accountingId: number }> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-20`;
  const tag = `[ALU-${opts.studentRef ?? "?"}#${thirdpartyId}]`;
  const label = `${tag} Pago IRPF Modelo 111 — ${String(opts.periodMonth).padStart(2, "0")}/${opts.periodYear}`;

  const res = await dolibarrFetch(config, "/accountancy/bookkeeping", {
    method: "POST",
    body: JSON.stringify({
      label,
      date_document: dateStr,
      journal_code: "BQ",
      lines: [
        { accountno: "4751", label, debit: opts.total, credit: 0 },
        { accountno: "572", label, debit: 0, credit: opts.total },
      ],
    }),
  });

  return { accountingId: await parseId(res, "payIRPFToBank") };
}

export async function createPayrollAccountingEntry(
  thirdpartyId: number,
  opts: {
    periodMonth: number;
    periodYear: number;
    employeeName: string;
    totalDevengos: number;
    ssEmpresa: number;
    liquidoPercibir: number;
    totalSsTrabajador: number;
    irpfAmount: number;
    studentRef?: string;
  },
): Promise<{ accountingId: number }> {
  const config = await getConfig();
  if (!config) throw new Error("No se pudo conectar con Dolibarr");

  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-28`;
  const tag = `[ALU-${opts.studentRef ?? "?"}#${thirdpartyId}]`;
  const label = `${tag} Nómina ${opts.employeeName} — ${String(opts.periodMonth).padStart(2, "0")}/${opts.periodYear}`;

  const ssAcreedores = opts.totalSsTrabajador + opts.ssEmpresa;

  const lines = [
    { accountno: "640", label, debit: opts.totalDevengos, credit: 0 },
    { accountno: "642", label: `SS empresa — ${label}`, debit: opts.ssEmpresa, credit: 0 },
    { accountno: "465", label: `Remuneraciones pend. — ${label}`, debit: 0, credit: opts.liquidoPercibir },
    { accountno: "476", label: `SS acreedores — ${label}`, debit: 0, credit: ssAcreedores },
    { accountno: "4751", label: `HP IRPF — ${label}`, debit: 0, credit: opts.irpfAmount },
  ];

  const res = await dolibarrFetch(config, "/accountancy/bookkeeping", {
    method: "POST",
    body: JSON.stringify({
      label,
      date_document: dateStr,
      journal_code: "OD",
      lines,
    }),
  });

  return { accountingId: await parseId(res, "createPayrollAccountingEntry") };
}
