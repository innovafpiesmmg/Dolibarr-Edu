import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  taxSystem: "igic",
  currency: "EUR",
  language: "es_ES",
  openprojectUrl: process.env.OP_HOST ? `https://${process.env.OP_HOST}` : "",
  collaboraUrl: process.env.COLLABORA_DOMAIN ? `https://${process.env.COLLABORA_DOMAIN}` : "",
  nextcloudUrl: process.env.NC_HOST ? `https://${process.env.NC_HOST}` : "",
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

async function getAllSettings() {
  const [taxSystem, currency, language, openprojectUrl, collaboraUrl, nextcloudUrl] = await Promise.all([
    getSetting("taxSystem"),
    getSetting("currency"),
    getSetting("language"),
    getSetting("openprojectUrl"),
    getSetting("collaboraUrl"),
    getSetting("nextcloudUrl"),
  ]);
  return { taxSystem, currency, language, openprojectUrl, collaboraUrl, nextcloudUrl };
}

router.get("/settings", async (req, res) => {
  res.json(await getAllSettings());
});

router.patch("/settings", async (req, res) => {
  const { taxSystem, openprojectUrl, collaboraUrl, nextcloudUrl } = req.body as {
    taxSystem?: string;
    openprojectUrl?: string;
    collaboraUrl?: string;
    nextcloudUrl?: string;
  };

  const updates: { key: string; value: string }[] = [];

  if (taxSystem !== undefined) {
    if (taxSystem !== "iva" && taxSystem !== "igic") {
      res.status(400).json({ error: "taxSystem debe ser 'iva' o 'igic'" });
      return;
    }
    updates.push({ key: "taxSystem", value: taxSystem });
  }

  if (openprojectUrl !== undefined) {
    updates.push({ key: "openprojectUrl", value: openprojectUrl });
  }

  if (collaboraUrl !== undefined) {
    updates.push({ key: "collaboraUrl", value: collaboraUrl });
  }

  if (nextcloudUrl !== undefined) {
    updates.push({ key: "nextcloudUrl", value: nextcloudUrl });
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
