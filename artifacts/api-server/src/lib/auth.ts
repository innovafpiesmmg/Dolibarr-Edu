import { createHmac } from "crypto";

export function adminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH ?? "";
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-secret-change-me";
}

export function generateAdminToken(): string {
  return createHmac("sha256", sessionSecret())
    .update(adminPasswordHash())
    .digest("hex");
}
