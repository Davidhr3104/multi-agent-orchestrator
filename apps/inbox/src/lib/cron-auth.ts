import { timingSafeEqual } from "node:crypto";
import { getSecret } from "@helix/core";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on the project.
 * Without the secret the automation stays off (503) rather than running for anyone who finds the URL.
 */
export function checkCronAuth(req: Request): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const secret = getSecret("CRON_SECRET");
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET is not configured, so the automation is off." };
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
