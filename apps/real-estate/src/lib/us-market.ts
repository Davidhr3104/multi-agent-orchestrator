export const US_MARKET_SOURCE_URL = "https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State_History.csv";
export const US_MARKET_SOURCE_PAGE = "https://www.realtor.com/research/data/";

const HISTORY_MONTHS = 13;

export type MarketMonth = {
  month: string;
  active: number | null;
  newListings: number | null;
  pending: number | null;
  price: number | null;
  dom: number | null;
  pendingRatio: number | null;
  reducedShare: number | null;
};

export type StateMarket = {
  id: string;
  name: string;
  latest: MarketMonth & { activeYy: number | null; newYy: number | null; priceYy: number | null; domYy: number | null };
  /** Oldest first, up to 13 months. */
  history: MarketMonth[];
};

export type UsMarket = {
  latestMonth: string;
  /** "live" = fetched from Realtor.com by this server; "snapshot" = the saved copy in src/data. */
  origin: "live" | "snapshot";
  fetchedAt: string;
  states: StateMarket[];
};

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "202609" → "Sep 2026" */
export function monthLabel(yyyymm: string) {
  const d = new Date(Date.UTC(Number(yyyymm.slice(0, 4)), Number(yyyymm.slice(4, 6)) - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Parses Realtor.com's state-level inventory CSV. Lines starting with "#" are comments. */
export function parseRealtorStates(csv: string): { latestMonth: string; states: StateMarket[]; fetchedNote: string | null } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const fetchedNote = lines.find((l) => l.startsWith("#"))?.match(/fetched (\S+)/)?.[1] ?? null;
  const [header, ...rows] = lines.filter((l) => !l.startsWith("#"));
  if (!header) throw new Error("Empty market file");
  const cols = header.split(",");
  const at = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`Market file is missing column ${name}`);
    return i;
  };
  const c = {
    month: at("month_date_yyyymm"),
    name: at("state"),
    id: at("state_id"),
    price: at("median_listing_price"),
    priceYy: at("median_listing_price_yy"),
    active: at("active_listing_count"),
    activeYy: at("active_listing_count_yy"),
    dom: at("median_days_on_market"),
    domYy: at("median_days_on_market_yy"),
    newListings: at("new_listing_count"),
    newYy: at("new_listing_count_yy"),
    reducedShare: at("price_reduced_share"),
    pending: at("pending_listing_count"),
    pendingRatio: at("pending_ratio"),
  };

  const byState = new Map<string, { name: string; rows: string[][] }>();
  for (const line of rows) {
    const f = line.split(",");
    const id = f[c.id]?.toUpperCase();
    if (!id || !/^\d{6}$/.test(f[c.month] ?? "")) continue;
    const entry = byState.get(id) ?? { name: f[c.name], rows: [] };
    entry.rows.push(f);
    byState.set(id, entry);
  }

  const toMonth = (f: string[]): MarketMonth => ({
    month: f[c.month],
    active: num(f[c.active]),
    newListings: num(f[c.newListings]),
    pending: num(f[c.pending]),
    price: num(f[c.price]),
    dom: num(f[c.dom]),
    pendingRatio: num(f[c.pendingRatio]),
    reducedShare: num(f[c.reducedShare]),
  });

  let latestMonth = "";
  const states: StateMarket[] = [];
  for (const [id, { name, rows: rs }] of byState) {
    rs.sort((a, b) => a[c.month].localeCompare(b[c.month]));
    const last = rs[rs.length - 1];
    if (last[c.month] > latestMonth) latestMonth = last[c.month];
    states.push({
      id,
      name,
      latest: { ...toMonth(last), activeYy: num(last[c.activeYy]), newYy: num(last[c.newYy]), priceYy: num(last[c.priceYy]), domYy: num(last[c.domYy]) },
      history: rs.slice(-HISTORY_MONTHS).map(toMonth),
    });
  }
  if (!states.length) throw new Error("No state rows in market file");
  states.sort((a, b) => a.name.localeCompare(b.name));
  return { latestMonth, states, fetchedNote };
}
