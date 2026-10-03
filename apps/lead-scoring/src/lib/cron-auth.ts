import { getSecret } from "@helix/core";
import { safeEqual } from "./intake";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET configured the
 * route stays closed (503) rather than open to anyone.
 */
export function checkCronAuth(req: Request): Response | null {
  const secret = getSecret("CRON_SECRET");
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured; cron route disabled." }, { status: 503 });
  }
  const header = req.headers.get("authorization")?.trim() || "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
