import { getSupabase } from "@/lib/supabase";
import type { FirmClient, FirmKnowledge, FirmMatter } from "@/lib/conflict-types";
import { memoryFirmKnowledge } from "@/lib/firm-memory";

function asStatus<T extends string>(value: string | null | undefined, fallback: T): T {
  if (value === "Active" || value === "Inactive" || value === "Closed") return value as T;
  return fallback;
}

export async function loadFirmKnowledge(): Promise<FirmKnowledge> {
  const db = getSupabase();
  if (!db) return memoryFirmKnowledge();
  try {
    const { data: clientRows, error: clientErr } = await db
      .from("firm_clients")
      .select("id, client_name, client_type, status");
    if (clientErr || !clientRows?.length) return memoryFirmKnowledge();
    const { data: matterRows, error: matterErr } = await db
      .from("firm_matters")
      .select("id, client_id, matter_name, opposing_party, matter_type, status");
    if (matterErr) return memoryFirmKnowledge();
    const clients: FirmClient[] = clientRows.map((row) => ({
      id: String(row.id),
      clientName: String(row.client_name ?? ""),
      clientType: String(row.client_type ?? "Corporate"),
      status: asStatus(String(row.status ?? "Active"), "Active"),
    }));
    const byId = new Map(clients.map((c) => [c.id, c.clientName]));
    const matters: FirmMatter[] = (matterRows ?? []).map((row) => ({
      id: String(row.id),
      clientId: String(row.client_id ?? ""),
      clientName: byId.get(String(row.client_id ?? "")) ?? "Unknown",
      matterName: String(row.matter_name ?? ""),
      opposingParty: row.opposing_party ? String(row.opposing_party) : null,
      matterType: row.matter_type ? String(row.matter_type) : null,
      status: asStatus(String(row.status ?? "Closed"), "Closed"),
    }));
    return { clients, matters, source: "supabase" };
  } catch {
    return memoryFirmKnowledge();
  }
}
