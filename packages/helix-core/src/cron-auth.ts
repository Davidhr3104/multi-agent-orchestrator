import { createHash, timingSafeEqual } from "node:crypto";
import { getSecret } from "./secrets";

/**
 * Gate for /api/cron/* routes. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Returns null when the request may run, otherwise the response to send:
 * 503 when CRON_SECRET is not configured (a cron must never run open), 401 on a wrong token.
 */
export function cronAuthResponse(req: Request): Response | null {
  const secret = getSecret("CRON_SECRET");
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured, so this cron refuses to run." }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const digest = (v: string) => createHash("sha256").update(v).digest();
  if (!token || !timingSafeEqual(digest(token), digest(secret))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
