import { getSupabase } from "@/lib/supabase";
import type { FirmClient, FirmKnowledge, FirmMatter } from "@/lib/conflict-types";
import { memoryFirmKnowledge } from "@/lib/firm-memory";

function asStatus<T extends string>(value: string | null | undefined, fallback: T): T {
  if (value === "Active" || value === "Inactive" || value === "Closed") return value as T;
  return fallback;
}

export async function createFirmClient(input: {
  clientName: string;
  clientType: string;
  status: "Active" | "Inactive";
}): Promise<{ ok: true; client: FirmClient } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured — cannot persist real firm clients." };
  const { data, error } = await db
    .from("firm_clients")
    .insert({ client_name: input.clientName, client_type: input.clientType, status: input.status })
    .select("id, client_name, client_type, status")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return {
    ok: true,
    client: {
      id: String(data.id),
      clientName: String(data.client_name ?? ""),
      clientType: String(data.client_type ?? "Corporate"),
      status: asStatus(String(data.status ?? "Active"), "Active"),
    },
  };
}

export async function updateFirmClient(
  id: string,
  patch: Partial<{ clientName: string; clientType: string; status: "Active" | "Inactive" }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const row: Record<string, unknown> = {};
  if (patch.clientName !== undefined) row.client_name = patch.clientName;
  if (patch.clientType !== undefined) row.client_type = patch.clientType;
  if (patch.status !== undefined) row.status = patch.status;
  const { error } = await db.from("firm_clients").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFirmClient(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db.from("firm_clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createFirmMatter(input: {
  clientId: string;
  matterName: string;
  opposingParty?: string;
  matterType?: string;
  status: "Active" | "Closed";
}): Promise<{ ok: true; matter: FirmMatter } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured — cannot persist real firm matters." };
  const { data, error } = await db
    .from("firm_matters")
    .insert({
      client_id: input.clientId,
      matter_name: input.matterName,
      opposing_party: input.opposingParty ?? null,
      matter_type: input.matterType ?? null,
      status: input.status,
    })
    .select("id, client_id, matter_name, opposing_party, matter_type, status")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  const { data: clientRow } = await db
    .from("firm_clients")
    .select("client_name")
    .eq("id", input.clientId)
    .maybeSingle();
  return {
    ok: true,
    matter: {
      id: String(data.id),
      clientId: String(data.client_id ?? ""),
      clientName: String(clientRow?.client_name ?? "Unknown"),
      matterName: String(data.matter_name ?? ""),
      opposingParty: data.opposing_party ? String(data.opposing_party) : null,
      matterType: data.matter_type ? String(data.matter_type) : null,
      status: asStatus(String(data.status ?? "Closed"), "Closed"),
    },
  };
}

export async function updateFirmMatter(
  id: string,
  patch: Partial<{ matterName: string; opposingParty: string | null; matterType: string | null; status: "Active" | "Closed" }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const row: Record<string, unknown> = {};
  if (patch.matterName !== undefined) row.matter_name = patch.matterName;
  if (patch.opposingParty !== undefined) row.opposing_party = patch.opposingParty;
  if (patch.matterType !== undefined) row.matter_type = patch.matterType;
  if (patch.status !== undefined) row.status = patch.status;
  const { error } = await db.from("firm_matters").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFirmMatter(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db.from("firm_matters").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
