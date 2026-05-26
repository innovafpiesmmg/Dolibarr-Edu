import app from "./app";
import { logger } from "./lib/logger";
import { rebuildAllRoutes, isTraefikConfigEnabled } from "./lib/traefik-config";
import { getBaseDomain } from "./routes/settings";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Reconstruye las rutas Traefik desde la BD al arrancar (idempotente).
  // Así sobrevivimos a reinicios del panel y a montajes nuevos del volumen.
  if (isTraefikConfigEnabled()) {
    getBaseDomain()
      .then((baseDomain) => rebuildAllRoutes(baseDomain || null))
      .catch((e) => logger.warn({ err: e }, "Fallo reconstruyendo rutas Traefik al arrancar"));
  }
});
