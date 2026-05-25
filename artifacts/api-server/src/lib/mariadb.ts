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
