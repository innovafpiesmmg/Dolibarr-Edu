import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { ZodError } from "zod/v4";
import router from "./routes";
import { requireAuth } from "./middleware/requireAuth";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", requireAuth, router);

// Global JSON error handler — must be registered AFTER all routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", details: err.issues });
    return;
  }

  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode
    ?? 500;

  const message =
    (err as { message?: string })?.message ?? "Error interno del servidor";

  req.log?.error({ err }, "Unhandled error");

  res.status(status).json({ error: message });
});

export default app;
