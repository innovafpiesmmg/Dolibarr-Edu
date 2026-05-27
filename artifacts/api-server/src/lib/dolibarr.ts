import { logger } from "./logger";

// ── DolibarrConfig: cada llamada requiere base URL + API key del alumno ────
//
// En el modelo per-container, cada alumno tiene su propio Dolibarr aislado
// con sus propios endpoints, su propia base de datos y su propio usuario
// admin. El panel se conecta a cada uno usando la URL interna Docker del
// contenedor del alumno y el token obtenido con su contraseña admin.
//
// La función `getStudentDolibarrConfig(student)` en `student-dolibarr.ts`
// construye este objeto a partir de un alumno; las rutas que tocan Dolibarr
// la usan para obtener el config correcto antes de llamar a cualquier
// función de este módulo.

export interface DolibarrConfig {
  apiUrl: string;
  apiKey: string;
}

async function dolibarrFetch(
  config: DolibarrConfig,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    DOLAPIKEY: config.apiKey,
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const url = `${config.apiUrl}/api/index.php${path}`;
  return fetch(url, { ...options, headers, signal: AbortSignal.timeout(30_000) });
}

async function parseId(res: Response, context: string): Promise<number> {
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, `Dolibarr error: ${context}`);
    throw new Error(`${context}: ${res.status} — ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as unknown;
  const id = typeof data === "number" ? data : (data as { id: number }).id;
  if (!id) throw new Error(`${context}: respuesta sin ID`);
  return id;
}

export type TaxSystem = "iva" | "igic";

// ── Usuarios Dolibarr (para miembros de equipo) ─────────────────────────────

export async function createDolibarrUser(
  config: DolibarrConfig,
  opts: {
    login: string;
    password: string;
    firstName: string;
    lastName: string;
    email: string;
    admin?: boolean;
  },
): Promise<{ userId: number }> {
  const res = await dolibarrFetch(config, "/users", {
    method: "POST",
    body: JSON.stringify({
      login: opts.login,
      pass: opts.password,
      firstname: opts.firstName,
      lastname: opts.lastName,
      email: opts.email,
      admin: opts.admin ? 1 : 0,
      statut: 1,
    }),
  });
  return { userId: await parseId(res, "createDolibarrUser") };
}

export async function findDolibarrUserIdByLogin(
  config: DolibarrConfig,
  login: string,
): Promise<number | null> {
  const res = await dolibarrFetch(
    config,
    `/users?sqlfilters=${encodeURIComponent(`(t.login:=:'${login}')`)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`findDolibarrUserIdByLogin(${login}): ${res.status} — ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] as { id?: number | string };
  const id = typeof first.id === "string" ? Number(first.id) : first.id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

export async function deleteDolibarrUser(config: DolibarrConfig, userId: number): Promise<void> {
  const res = await dolibarrFetch(config, `/users/${userId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`deleteDolibarrUser(${userId}): ${res.status} — ${text.slice(0, 200)}`);
  }
}

// ── HRM — Empleados ──────────────────────────────────────────────────────────
//
// En el modelo per-container ya NO necesitamos `fk_soc` para filtrar — cada
// Dolibarr es del alumno y contiene solo sus propios empleados.

export async function createDolibarrEmployee(
  config: DolibarrConfig,
  opts: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    contractType: "indefinido" | "temporal";
    salaryBase: number;
    dni?: string | null;
  },
): Promise<{ employeeId: number }> {
  const res = await dolibarrFetch(config, "/hrm/employees", {
    method: "POST",
    body: JSON.stringify({
      firstname: opts.firstName,
      lastname: opts.lastName,
      job: opts.jobTitle,
      contract_type: opts.contractType === "indefinido" ? 1 : 2,
      salary: opts.salaryBase,
      ref_number: opts.dni ?? "",
      statut: 1,
    }),
  });
  return { employeeId: await parseId(res, "createDolibarrEmployee") };
}

// ── Salario ──────────────────────────────────────────────────────────────────

export async function createDolibarrSalary(
  config: DolibarrConfig,
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

// ── Asientos contables ───────────────────────────────────────────────────────

export async function paySSToBank(
  config: DolibarrConfig,
  opts: { periodMonth: number; periodYear: number; total: number },
): Promise<{ accountingId: number }> {
  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-28`;
  const label = `Pago SS Tesorería — ${String(opts.periodMonth).padStart(2, "0")}/${opts.periodYear}`;

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
  config: DolibarrConfig,
  opts: { periodMonth: number; periodYear: number; total: number },
): Promise<{ accountingId: number }> {
  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-20`;
  const label = `Pago IRPF Modelo 111 — ${String(opts.periodMonth).padStart(2, "0")}/${opts.periodYear}`;

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
  config: DolibarrConfig,
  opts: {
    periodMonth: number;
    periodYear: number;
    employeeName: string;
    totalDevengos: number;
    ssEmpresa: number;
    liquidoPercibir: number;
    totalSsTrabajador: number;
    irpfAmount: number;
  },
): Promise<{ accountingId: number }> {
  const dateStr = `${opts.periodYear}-${String(opts.periodMonth).padStart(2, "0")}-28`;
  const label = `Nómina ${opts.employeeName} — ${String(opts.periodMonth).padStart(2, "0")}/${opts.periodYear}`;
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

// ── Activar módulos REST API + HRM + Comptabilité dentro del Dolibarr ─────
//
// La imagen Dolibarr no activa módulos opcionales por defecto. Para que el
// panel pueda hacer llamadas a /api/index.php/* el módulo API debe estar
// activo. Se activa en el primer arranque desde fuera vía SQL en la BD
// del alumno (ver `student-deploy.ts`).
