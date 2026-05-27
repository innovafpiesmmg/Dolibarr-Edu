import mysql from "mysql2/promise";
import { logger } from "./logger";

function rootConfig(): mysql.ConnectionOptions | null {
  const host = process.env.MARIADB_HOST;
  const password = process.env.MARIADB_ROOT_PASSWORD;
  if (!host || !password) return null;
  return {
    host,
    port: Number(process.env.MARIADB_PORT ?? 3306),
    user: process.env.MARIADB_ROOT_USER ?? "root",
    password,
    multipleStatements: false,
  };
}

export function isMariaDBConfigured(): boolean {
  return rootConfig() !== null;
}

// MariaDB identifiers (DB/user names) — we validate strictly because they cannot
// be parameterized. All names we generate come from sanitize() in
// student-dolibarr.ts which constrains characters to [a-z0-9_], so this regex
// should always pass; it's a defense-in-depth check.
const SAFE_IDENT = /^[a-z0-9_]{1,64}$/;

function assertIdent(label: string, value: string): void {
  if (!SAFE_IDENT.test(value)) {
    throw new Error(`MariaDB: nombre ${label} inválido: ${JSON.stringify(value)}`);
  }
}

// Escape a string literal for SQL (handles quotes/backslashes/etc.).
// Returns the value already wrapped in single quotes.
function quote(value: string): string {
  // mysql2 exposes `escape` on its Connection prototype; the static helper
  // lives on the default module export. Use a local minimal implementation to
  // avoid coupling to internals.
  return "'" + value.replace(/[\0\b\t\n\r\x1a\\'"]/g, (ch) => {
    switch (ch) {
      case "\0": return "\\0";
      case "\b": return "\\b";
      case "\t": return "\\t";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\x1a": return "\\Z";
      case "\\": return "\\\\";
      case "'": return "\\'";
      case '"': return '\\"';
      default: return ch;
    }
  }) + "'";
}

export async function isMariaDBAvailable(): Promise<boolean> {
  const cfg = rootConfig();
  if (!cfg) return false;
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(cfg);
    await conn.ping();
    return true;
  } catch {
    return false;
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

export async function ensureStudentDatabase(
  dbName: string,
  dbUser: string,
  dbPassword: string,
): Promise<void> {
  const cfg = rootConfig();
  if (!cfg) throw new Error("MariaDB no configurada (faltan MARIADB_HOST / MARIADB_ROOT_PASSWORD)");
  assertIdent("dbName", dbName);
  assertIdent("dbUser", dbUser);

  const pwd = quote(dbPassword);
  const userSql = `${quote(dbUser)}@'%'`;

  const conn = await mysql.createConnection(cfg);
  try {
    // Crear BD y usuario son operaciones idempotentes
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`CREATE USER IF NOT EXISTS ${userSql} IDENTIFIED BY ${pwd}`);
    // Re-aplicar contraseña (idempotente; ALTER USER es seguro si ya existe)
    await conn.query(`ALTER USER ${userSql} IDENTIFIED BY ${pwd}`);
    await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ${userSql}`);
    await conn.query(`FLUSH PRIVILEGES`);
    logger.info({ dbName, dbUser }, "Base de datos de alumno asegurada");
  } finally {
    await conn.end().catch(() => {});
  }
}

// Activa una lista de módulos Dolibarr en la BD del alumno insertando las
// constantes `MAIN_MODULE_<NAME>` (y los flags estándar de menús/triggers/
// hooks/login) en `llx_const`.
//
// IMPORTANTE: las constantes de módulo se almacenan con `entity=1` (la entidad
// por defecto en instalaciones single-tenant). Con `entity=0` Dolibarr no las
// reconoce como activación de módulo y los menús no aparecen.
//
// La operación es idempotente y reactivadora: usa `ON DUPLICATE KEY UPDATE
// value='1'`, por lo que si un módulo estaba desactivado (value='0'), este
// método vuelve a ponerlo a '1'. Dolibarr lee `llx_const` en cada request, así
// que NO hace falta reiniciar el contenedor.
export async function enableModulesInStudentDb(
  dbName: string,
  moduleNames: readonly string[],
): Promise<void> {
  const cfg = rootConfig();
  if (!cfg) throw new Error("MariaDB no configurada");
  assertIdent("dbName", dbName);

  // Validar nombres de módulo: alfanuméricos, sin caracteres especiales.
  const SAFE_MODULE = /^[A-Z][A-Z0-9_]{1,40}$/;
  const names = moduleNames.filter((n) => {
    const ok = SAFE_MODULE.test(n);
    if (!ok) logger.warn({ module: n }, "Nombre de módulo Dolibarr ignorado (no válido)");
    return ok;
  });
  if (names.length === 0) return;

  // Por cada módulo activamos su flag principal y los sub-flags habituales
  // que Dolibarr crea cuando se activa el módulo desde la UI.
  const SUBFLAGS = ["TRIGGERS", "HOOKS", "LOGIN", "MENUS", "SUBSTITUTIONS"] as const;
  const rows: string[] = [];
  for (const name of names) {
    rows.push(`('MAIN_MODULE_${name}', 1, '1', 'chaine', 0, NULL)`);
    for (const sub of SUBFLAGS) {
      rows.push(`('MAIN_MODULE_${name}_${sub}', 1, '1', 'chaine', 0, NULL)`);
    }
  }

  const conn = await mysql.createConnection({ ...cfg, database: dbName });
  try {
    // Comprobación: la tabla `llx_const` debe existir (la crea el instalador de
    // Dolibarr en el primer arranque). Si no existe abortamos limpiamente.
    const [tables] = await conn.query<mysql.RowDataPacket[]>(
      "SHOW TABLES LIKE 'llx_const'",
    );
    if (!Array.isArray(tables) || tables.length === 0) {
      throw new Error(`Tabla llx_const no encontrada en ${dbName} (¿Dolibarr terminó su instalación inicial?)`);
    }

    // ON DUPLICATE KEY UPDATE garantiza que si el módulo ya existía como
    // desactivado (value='0'), pase a activo (value='1'). Si no, lo inserta.
    const sql =
      `INSERT INTO llx_const (name, entity, value, type, visible, note) VALUES ` +
      rows.join(", ") +
      ` ON DUPLICATE KEY UPDATE value='1'`;
    await conn.query(sql);
    logger.info({ dbName, count: names.length }, "Módulos Dolibarr activados vía SQL");
  } finally {
    await conn.end().catch(() => {});
  }
}

export async function dropStudentDatabase(dbName: string, dbUser: string): Promise<void> {
  const cfg = rootConfig();
  if (!cfg) throw new Error("MariaDB no configurada");
  assertIdent("dbName", dbName);
  assertIdent("dbUser", dbUser);

  const userSql = `${quote(dbUser)}@'%'`;
  const conn = await mysql.createConnection(cfg);
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await conn.query(`DROP USER IF EXISTS ${userSql}`);
    await conn.query(`FLUSH PRIVILEGES`);
    logger.info({ dbName, dbUser }, "Base de datos de alumno eliminada");
  } finally {
    await conn.end().catch(() => {});
  }
}
