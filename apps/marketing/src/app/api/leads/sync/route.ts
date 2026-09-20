import { attributedFromStored, upsertAttributedLeads } from "@/lib/store";
import type { StoredLead } from "@helix/core";

export const runtime = "nodejs";

function leadsBase(): string {
  return (process.env.HELIX_LEADS_URL?.trim() || "http://127.0.0.1:43148").replace(/\/$/, "");
}

export async function POST() {
  let res: Response;
  try {
    res = await fetch(`${leadsBase()}/api/leads`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch {
    return Response.json(
      { error: `Could not reach Helix for Leads at ${leadsBase()}. Start it on 43148 or set HELIX_LEADS_URL.` },
      { status: 502 }
    );
  }
  if (!res.ok) {
    return Response.json({ error: `Leads desk HTTP ${res.status}` }, { status: 502 });
  }
  const data = (await res.json()) as { leads?: StoredLead[] };
  const mapped = (data.leads ?? [])
    .map((lead) => attributedFromStored(lead))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const snap = await upsertAttributedLeads(mapped);
  return Response.json({
    imported: mapped.length,
    skipped: (data.leads ?? []).length - mapped.length,
    unmatched: snap.unmatched.length,
    source: leadsBase(),
  });
}
