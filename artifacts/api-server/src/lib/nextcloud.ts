const NC_BASE_URL = (process.env.NEXTCLOUD_URL ?? "").replace(/\/$/, "");
const NC_ADMIN_USER = process.env.NC_ADMIN_USER ?? "admin";
const NC_ADMIN_PASSWORD = process.env.NC_ADMIN_PASSWORD ?? "";

export function isNextcloudConfigured(): boolean {
  return !!(process.env.NEXTCLOUD_URL && process.env.NC_ADMIN_PASSWORD);
}

function authHeader(): string {
  return (
    "Basic " +
    Buffer.from(`${NC_ADMIN_USER}:${NC_ADMIN_PASSWORD}`).toString("base64")
  );
}

async function ocsRequest(
  method: string,
  path: string,
  body?: Record<string, string>,
): Promise<unknown> {
  const url = `${NC_BASE_URL}/ocs/v2.php${path}?format=json`;
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    "OCS-APIREQUEST": "true",
  };

  let bodyStr: string | undefined;
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    bodyStr = new URLSearchParams(body).toString();
  }

  const response = await fetch(url, { method, headers, body: bodyStr });

  const data = (await response.json()) as {
    ocs: { meta: { statuscode: number; message: string }; data: unknown };
  };

  const code = data?.ocs?.meta?.statuscode;
  // 100 = OK in OCS v1, 200 = OK in OCS v2
  if (code !== 100 && code !== 200) {
    throw new Error(data?.ocs?.meta?.message ?? `OCS error ${code}`);
  }

  return data?.ocs?.data;
}

export interface NextcloudStatus {
  connected: boolean;
  adminUser?: string;
}

export async function pingNextcloud(): Promise<NextcloudStatus> {
  if (!isNextcloudConfigured()) return { connected: false };
  try {
    await ocsRequest(
      "GET",
      `/cloud/users/${encodeURIComponent(NC_ADMIN_USER)}`,
    );
    return { connected: true, adminUser: NC_ADMIN_USER };
  } catch {
    return { connected: false };
  }
}

export async function createNextcloudUser(params: {
  username: string;
  password: string;
  displayName: string;
  email: string;
  quota?: string;
}): Promise<void> {
  await ocsRequest("POST", "/cloud/users", {
    userid: params.username,
    password: params.password,
    displayName: params.displayName,
    email: params.email,
    quota: params.quota ?? "5 GB",
  });
}

export async function nextcloudUserExists(username: string): Promise<boolean> {
  try {
    await ocsRequest("GET", `/cloud/users/${encodeURIComponent(username)}`);
    return true;
  } catch {
    return false;
  }
}

export async function deleteNextcloudUser(username: string): Promise<void> {
  try {
    await ocsRequest(
      "DELETE",
      `/cloud/users/${encodeURIComponent(username)}`,
    );
  } catch {
    // Ignore if user doesn't exist
  }
}

export function generateNcPassword(username: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256")
    .update(username + (process.env.SESSION_SECRET ?? "nc-edu"))
    .digest("hex")
    .slice(0, 20);
}
