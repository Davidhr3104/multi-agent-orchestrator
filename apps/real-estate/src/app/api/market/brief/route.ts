import { deskWriteDenied } from "@/lib/ai-desk";
import { writeMarketBrief, type MarketBriefResult } from "@/lib/market-brief";
import { getUsMarket } from "@/lib/us-market-source";

export const runtime = "nodejs";

const CACHE_TTL = 12 * 3_600_000;
const cache = new Map<string, { until: number; result: MarketBriefResult }>();

/**
 * Claude writes a short brief from the Realtor.com figures this server already loaded. The data changes monthly,
 * so a brief is reused for 12 hours per month and state selection instead of paying for it again.
 */
export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { states?: unknown };
  const states = Array.isArray(body.states) ? body.states.filter((s): s is string => typeof s === "string" && /^[A-Z]{2}$/.test(s)).slice(0, 5).sort() : [];
  const market = await getUsMarket();
  if (!market) return Response.json({ ok: false, error: "No Realtor.com data is loaded." }, { status: 503 });
  const key = `${market.latestMonth}|${states.join(",")}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return Response.json({ ...hit.result, origin: market.origin, cached: true });
  const r = await writeMarketBrief(market, states);
  if (r.ok) cache.set(key, { until: Date.now() + CACHE_TTL, result: r });
  return Response.json({ ...r, origin: market.origin, cached: false }, { status: r.ok ? 200 : 409 });
}
