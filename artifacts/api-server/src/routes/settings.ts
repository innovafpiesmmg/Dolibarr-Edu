import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  taxSystem: "igic",
  currency: "EUR",
  language: "es_ES",
  baseDomain: process.env.BASE_DOMAIN ?? "",
};

async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getTaxSystem(): Promise<"iva" | "igic"> {
  const val = await getSetting("taxSystem");
  return val === "iva" ? "iva" : "igic";
}

export async function getBaseDomain(): Promise<string> {
  return getSetting("baseDomain");
}

async function getAllSettings() {
  const [taxSystem, currency, language, baseDomain] = await Promise.all([
    getSetting("taxSystem"),
    getSetting("currency"),
    getSetting("language"),
    getSetting("baseDomain"),
  ]);
  return { taxSystem, currency, language, baseDomain };
}

router.get("/settings", async (_req, res) => {
  res.json(await getAllSettings());
});

router.patch("/settings", async (req, res) => {
  const { taxSystem, baseDomain } = req.body as {
    taxSystem?: string;
    baseDomain?: string;
  };

  const updates: { key: string; value: string }[] = [];

  if (taxSystem !== undefined) {
    if (taxSystem !== "iva" && taxSystem !== "igic") {
      res.status(400).json({ error: "taxSystem debe ser 'iva' o 'igic'" });
      return;
    }
    updates.push({ key: "taxSystem", value: taxSystem });
  }

  if (baseDomain !== undefined) {
    const trimmed = baseDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (trimmed && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
      res.status(400).json({ error: "baseDomain inválido (ej: iesmmg.es)" });
      return;
    }
    updates.push({ key: "baseDomain", value: trimmed });
  }

  for (const { key, value } of updates) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  }

  res.json(await getAllSettings());
});

export default router;
