import { mkdir, writeFile, unlink, readdir } from "fs/promises";
import { join } from "path";
import { logger } from "./logger";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { containerName, publicHostname } from "./student-dolibarr";

const DYNAMIC_DIR = process.env.TRAEFIK_DYNAMIC_DIR ?? "/etc/traefik/dynamic";

export function isTraefikConfigEnabled(): boolean {
  return Boolean(process.env.TRAEFIK_DYNAMIC_DIR);
}

// IMPORTANTE: el file provider de Traefik en modo `directory` SOLO procesa
// ficheros con extensión .toml/.yml/.yaml — ignora .json silenciosamente.
// Usamos .yaml; JSON es YAML válido, así que escribimos JSON dentro.
function fileFor(username: string): string {
  return join(DYNAMIC_DIR, `student-${username}.yaml`);
}

// Limpieza de ficheros .json antiguos que pudieran quedar de versiones previas
function legacyFileFor(username: string): string {
  return join(DYNAMIC_DIR, `student-${username}.json`);
}

function routeConfig(username: string, hostname: string): unknown {
  const id = `dolibarr-${containerName(username)}`;
  return {
    http: {
      routers: {
        [id]: {
          rule: `Host(\`${hostname}\`)`,
          service: id,
          entryPoints: ["web"],
        },
      },
      services: {
        [id]: {
          loadBalancer: {
            servers: [{ url: `http://${containerName(username)}:80` }],
          },
        },
      },
    },
  };
}

export async function writeStudentRoute(username: string, baseDomain: string): Promise<void> {
  if (!isTraefikConfigEnabled()) return;
  if (!baseDomain) return;
  await mkdir(DYNAMIC_DIR, { recursive: true });
  const cfg = routeConfig(username, publicHostname(username, baseDomain));
  const path = fileFor(username);
  await writeFile(path, JSON.stringify(cfg, null, 2));
  logger.info({ username, path }, "Ruta Traefik escrita");
}

export async function removeStudentRoute(username: string): Promise<void> {
  if (!isTraefikConfigEnabled()) return;
  const ignoreMissing = (err: NodeJS.ErrnoException) => {
    if (err.code !== "ENOENT") throw err;
  };
  await unlink(fileFor(username)).catch(ignoreMissing);
  await unlink(legacyFileFor(username)).catch(ignoreMissing);
  logger.info({ username }, "Ruta Traefik eliminada");
}

export async function rebuildAllRoutes(baseDomain: string | null): Promise<void> {
  if (!isTraefikConfigEnabled()) return;
  if (!baseDomain) {
    logger.warn("No hay dominio base configurado; no se reconstruyen rutas Traefik");
    return;
  }
  await mkdir(DYNAMIC_DIR, { recursive: true });

  // Borra ficheros student-* existentes (.yaml actuales y .json legacy)
  // para empezar limpio antes de regenerar.
  const existing = await readdir(DYNAMIC_DIR).catch(() => [] as string[]);
  await Promise.all(
    existing
      .filter((f) => f.startsWith("student-") && (f.endsWith(".yaml") || f.endsWith(".json")))
      .map((f) => unlink(join(DYNAMIC_DIR, f)).catch(() => undefined)),
  );

  // Genera uno por alumno desplegado
  const students = await db
    .select({ username: studentsTable.username })
    .from(studentsTable)
    .where(eq(studentsTable.dolibarrSyncStatus, "synced"));

  await Promise.all(
    students.map((s) => writeStudentRoute(s.username, baseDomain)),
  );
  logger.info({ count: students.length }, "Rutas Traefik reconstruidas desde BD");
}
