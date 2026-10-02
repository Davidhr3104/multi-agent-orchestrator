import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRealtorStates, US_MARKET_SOURCE_URL, type UsMarket } from "@/lib/us-market";

const LIVE_TTL = 12 * 3_600_000;
const FALLBACK_TTL = 10 * 60_000;

let cache: { until: number; data: UsMarket } | null = null;

/** Realtor.com publishes this file monthly; the server re-checks it at most every 12 hours and falls back to the saved copy. */
export async function getUsMarket(): Promise<UsMarket | null> {
  const now = Date.now();
  if (cache && cache.until > now) return cache.data;
  try {
    const res = await fetch(US_MARKET_SOURCE_URL, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Realtor.com returned ${res.status}`);
    const { latestMonth, states } = parseRealtorStates(await res.text());
    const data: UsMarket = { latestMonth, states, origin: "live", fetchedAt: new Date(now).toISOString() };
    cache = { until: now + LIVE_TTL, data };
    return data;
  } catch {
    try {
      const { latestMonth, states, fetchedNote } = parseRealtorStates(await readFile(join(process.cwd(), "src/data/rdc-state-snapshot.csv"), "utf8"));
      const data: UsMarket = { latestMonth, states, origin: "snapshot", fetchedAt: fetchedNote ?? "" };
      cache = { until: now + FALLBACK_TTL, data };
      return data;
    } catch {
      return null;
    }
  }
}
