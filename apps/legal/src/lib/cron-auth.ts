import { timingSafeEqual } from "node:crypto";
import { getSecret } from "@helix/core";

export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without a configured secret the route stays closed. */
export function verifyCronRequest(req: Request, secret: string = getSecret("CRON_SECRET")): CronAuth {
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET is not configured; the scheduled job is disabled." };
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  return { ok: true };
}
