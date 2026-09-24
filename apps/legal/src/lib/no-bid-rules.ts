import { getSupabase } from "@/lib/supabase";
import { memoryNoBidRules } from "@/lib/no-bid-memory";
import type { NoBidRule } from "@/lib/pricing-types";

export async function loadNoBidRules(): Promise<{ rules: NoBidRule[]; source: "supabase" | "memory" }> {
  const db = getSupabase();
  if (!db) return { rules: memoryNoBidRules(), source: "memory" };
  try {
    const { data, error } = await db
      .from("no_bid_rules")
      .select("id, pattern, reason, enabled, created_at")
      .order("created_at", { ascending: false });
    if (error || !data) return { rules: memoryNoBidRules(), source: "memory" };
    return {
      rules: data.map((row) => ({
        id: String(row.id),
        pattern: String(row.pattern ?? ""),
        reason: String(row.reason ?? ""),
        enabled: Boolean(row.enabled ?? true),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      })),
      source: "supabase",
    };
  } catch {
    return { rules: memoryNoBidRules(), source: "memory" };
  }
}

export async function createNoBidRule(input: {
  pattern: string;
  reason: string;
}): Promise<{ ok: true; rule: NoBidRule } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured — cannot persist real no-bid rules." };
  const { data, error } = await db
    .from("no_bid_rules")
    .insert({ pattern: input.pattern, reason: input.reason, enabled: true })
    .select("id, pattern, reason, enabled, created_at")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return {
    ok: true,
    rule: {
      id: String(data.id),
      pattern: String(data.pattern ?? ""),
      reason: String(data.reason ?? ""),
      enabled: Boolean(data.enabled),
      createdAt: String(data.created_at),
    },
  };
}

export async function updateNoBidRule(
  id: string,
  patch: Partial<{ pattern: string; reason: string; enabled: boolean }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const row: Record<string, unknown> = {};
  if (patch.pattern !== undefined) row.pattern = patch.pattern;
  if (patch.reason !== undefined) row.reason = patch.reason;
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  const { error } = await db.from("no_bid_rules").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteNoBidRule(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db.from("no_bid_rules").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Case-insensitive substring match of each enabled rule's pattern against the RFP text — first hit wins. */
export function checkNoBidRules(
  rfpText: string,
  rules: NoBidRule[]
): { blocked: true; rule: NoBidRule } | { blocked: false } {
  const haystack = rfpText.toLowerCase();
  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern.trim()) continue;
    if (haystack.includes(rule.pattern.toLowerCase().trim())) {
      return { blocked: true, rule };
    }
  }
  return { blocked: false };
}
