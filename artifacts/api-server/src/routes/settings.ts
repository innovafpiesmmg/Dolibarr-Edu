import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  taxSystem: "igic",
  currency: "EUR",
  language: "es_ES",
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

router.get("/settings", async (req, res) => {
  const [taxSystem, currency, language] = await Promise.all([
    getSetting("taxSystem"),
    getSetting("currency"),
    getSetting("language"),
  ]);
  res.json({ taxSystem, currency, language });
});

router.patch("/settings", async (req, res) => {
  const { taxSystem } = req.body as { taxSystem?: string };

  const updates: { key: string; value: string }[] = [];

  if (taxSystem !== undefined) {
    if (taxSystem !== "iva" && taxSystem !== "igic") {
      res.status(400).json({ error: "taxSystem debe ser 'iva' o 'igic'" });
      return;
    }
    updates.push({ key: "taxSystem", value: taxSystem });
  }

  for (const { key, value } of updates) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  }

  const [ts, currency, language] = await Promise.all([
    getSetting("taxSystem"),
    getSetting("currency"),
    getSetting("language"),
  ]);
  res.json({ taxSystem: ts, currency, language });
});

export default router;
