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

async function start(): Promise<void> {
  // Reconstruye las rutas Traefik desde la BD ANTES de aceptar peticiones.
  // Hacerlo después abriría una race condition: un POST /students/:id/deploy
  // entrante podría escribir su .yaml justo antes del borrado masivo inicial
  // de rebuildAllRoutes y perderlo.
  if (isTraefikConfigEnabled()) {
    try {
      const baseDomain = await getBaseDomain();
      await rebuildAllRoutes(baseDomain || null);
    } catch (e) {
      logger.warn({ err: e }, "Fallo reconstruyendo rutas Traefik al arrancar");
    }
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((e) => {
  logger.error({ err: e }, "Fatal startup error");
  process.exit(1);
});
