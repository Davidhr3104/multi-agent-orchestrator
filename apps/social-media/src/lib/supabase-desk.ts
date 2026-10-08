import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoGate, getSecret, onSecretsChanged } from "@helix/core";

type Client = SupabaseClient;
let cached: Client | null | undefined;
onSecretsChanged(() => {
  cached = undefined;
});

export function isSupabaseConfigured(): boolean {
  return Boolean(
    getSecret("NEXT_PUBLIC_SUPABASE_URL") &&
      (getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  );
}

/** Demo never reads or writes Social desk JSON. Live persists the in-memory workspaces. */
export const socialGate = createDemoGate("social");

export function getSupabase(): Client | null {
  if (socialGate.suspended()) return null;
  if (cached !== undefined) return cached;
  const url = getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const key = getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

const ORG = "default";

type DeskQuery = {
  select: (cols: string) => {
    eq: (col: string, value: string) => {
      maybeSingle: () => Promise<{ data: { snapshot: unknown } | null; error: { message: string } | null }>;
    };
  };
  upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
};

function table(db: Client): DeskQuery {
  return (db as unknown as { schema: (name: string) => { from: (t: string) => DeskQuery } }).schema("social").from("desk_state");
}

export async function loadDeskSnapshot(): Promise<unknown | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await table(db).select("snapshot").eq("org_id", ORG).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.snapshot ?? null;
}

export async function saveDeskSnapshot(snapshot: unknown): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await table(db).upsert({ org_id: ORG, snapshot, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
}
