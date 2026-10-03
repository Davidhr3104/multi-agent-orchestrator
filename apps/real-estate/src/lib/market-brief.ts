import { callClaude, claudeReady } from "./ai-claude";
import { factCheck, type AiCost } from "./ai-copy";
import { monthLabel, type UsMarket } from "./us-market";

/**
 * A short written brief on the Realtor.com figures already loaded on the US Market page. The numbers are computed
 * here and passed in; Claude only writes prose around them and must cite the month.
 */

const pct = (v: number | null) => (v === null ? "n/a" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const int = (v: number | null) => (v === null ? "n/a" : Math.round(v).toLocaleString("en-US"));

export function marketFacts(market: UsMarket, focusStates: string[] = []): string {
  const month = monthLabel(market.latestMonth);
  const current = market.states.filter((s) => s.latest.month === market.latestMonth);
  const forSale = current.reduce((s, x) => s + (x.latest.active ?? 0), 0);
  const yearAgo = current.reduce((s, x) => s + (x.latest.active !== null && x.latest.activeYy !== null ? x.latest.active / (1 + x.latest.activeYy) : 0), 0);
  const newListings = current.reduce((s, x) => s + (x.latest.newListings ?? 0), 0);
  const up = current.filter((s) => (s.latest.activeYy ?? 0) > 0).length;
  const top = [...current].sort((a, b) => (b.latest.active ?? 0) - (a.latest.active ?? 0)).slice(0, 5);
  const focus = current.filter((s) => focusStates.includes(s.id) && !top.includes(s));
  const line = (s: (typeof current)[number]) =>
    `- ${s.name} (${s.id}): ${int(s.latest.active)} for sale (${pct(s.latest.activeYy)} vs last year), median asking price $${int(s.latest.price)} (${pct(s.latest.priceYy)}), median ${int(s.latest.dom)} days on market, pending ratio ${s.latest.pendingRatio === null ? "n/a" : s.latest.pendingRatio.toFixed(2)}`;
  return [
    `Source: Realtor.com residential listings data, month ${month}.`,
    `National homes for sale (sum of states): ${int(forSale)}`,
    `Vs last year: ${yearAgo ? pct((forSale - yearAgo) / yearAgo) : "n/a"}`,
    `New listings in ${month}: ${int(newListings)}`,
    `States with inventory up year over year: ${up} of ${current.length}`,
    `States with the most homes for sale:`,
    ...top.map(line),
    ...(focus.length ? ["Agent's states:", ...focus.map(line)] : []),
  ].join("\n");
}

export type MarketBriefResult = { ok: true; text: string; month: string; cost: AiCost } | { ok: false; error: string; month: string };

const SYSTEM = `You write a short market brief for a US real-estate agent from Realtor.com monthly figures.
Use ONLY the numbers in the facts, exactly as given (you may round). Do not forecast, do not give advice on prices, do not add other sources.
Write 4-5 plain sentences, no headings or bullets. Mention the month and that the source is Realtor.com.`;

export async function writeMarketBrief(market: UsMarket, focusStates: string[] = [], fetchImpl?: typeof fetch): Promise<MarketBriefResult> {
  const month = monthLabel(market.latestMonth);
  if (!claudeReady()) return { ok: false, month, error: "Claude isn't connected (no Anthropic API key on this server)." };
  const facts = marketFacts(market, focusStates);
  const r = await callClaude({ feature: "market_brief", system: SYSTEM, prompt: `Facts:\n${facts}`, maxTokens: 450, fetchImpl });
  if (!r.ok) return { ok: false, month, error: r.error };
  const problem = factCheck(r.text, facts);
  if (problem) return { ok: false, month, error: `The brief was discarded because ${problem}.` };
  if (!r.text.includes(month.split(" ")[0])) return { ok: false, month, error: `The brief was discarded because it didn't cite the month (${month}).` };
  return { ok: true, month, text: r.text.slice(0, 1500), cost: { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, estUsd: r.usage.estUsd } };
}
