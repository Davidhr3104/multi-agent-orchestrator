import path from "node:path";
import os from "node:os";

/** Mirrors helix-core's resetSecretsCache(), which the package index does not export. */
function resetSecretsCache() {
  const g = globalThis as { __helixSecrets?: unknown; __helixSecretsLoaded?: boolean };
  g.__helixSecrets = undefined;
  g.__helixSecretsLoaded = false;
}

const KEYS = [
  "ANTHROPIC_API_KEY",
  "HUBSPOT_TOKEN",
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "CRON_SECRET",
  "HELIX_INTAKE_TOKEN",
  "HELIX_DESK_SEED",
  "HELIX_SECRETS_PATH",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Isolates a test from real credentials: points the secrets file at a path that does not exist
 * and clears every integration env var. Returns a restore function.
 */
export function isolateSecrets(env: Partial<Record<(typeof KEYS)[number], string>> = {}): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.HELIX_SECRETS_PATH = path.join(os.tmpdir(), `helix-leads-test-${process.pid}-none.json`);
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  resetSecretsCache();
  return () => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetSecretsCache();
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function claudeResponse(text: string, usage = { input_tokens: 120, output_tokens: 40 }): Response {
  return jsonResponse({ content: [{ type: "text", text }], usage });
}
