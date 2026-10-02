// Saves the last 13 months of Realtor.com's state inventory file as the offline fallback for /market.
// Run: npm run market:snapshot
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State_History.csv";
const OUT = fileURLToPath(new URL("../src/data/rdc-state-snapshot.csv", import.meta.url));
const MONTHS = 13;

const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(60_000) });
if (!res.ok) throw new Error(`Realtor.com returned ${res.status}`);
const [header, ...rows] = (await res.text()).trim().split(/\r?\n/);
const months = [...new Set(rows.map((r) => r.slice(0, 6)))].sort().slice(-MONTHS);
const keep = rows.filter((r) => months.includes(r.slice(0, 6)));

await writeFile(OUT, [`# fetched ${new Date().toISOString()} from ${SOURCE_URL}`, header, ...keep].join("\n") + "\n");
console.log(`Saved ${keep.length} rows (${months[0]}–${months.at(-1)}) to ${OUT}`);
