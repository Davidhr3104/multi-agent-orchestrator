import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SecretField } from "./secret-fields";
export type { SecretField };
export {
  KEYS_COMMERCE,
  KEYS_INBOX,
  KEYS_LEADS,
  KEYS_LEGAL,
  KEYS_MARKETING,
  KEYS_SHARED,
} from "./secret-fields";

const ALLOWED = new Set([
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "SLACK_WEBHOOK_URL",
  "CALENDLY_URL",
  "BUILTWITH_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "GMAIL_ACCESS_TOKEN",
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_ACCESS_TOKEN",
  "META_ACCESS_TOKEN",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "HELIX_OPERATOR_KEY",
]);

type SecretMap = Record<string, string>;

const g = globalThis as { __helixSecrets?: SecretMap; __helixSecretsLoaded?: boolean };
const listeners = new Set<() => void>();

export type SecretStatus = SecretField & {
  configured: boolean;
  masked: string | null;
};

export function onSecretsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetSecretsCache(): void {
  g.__helixSecrets = undefined;
  g.__helixSecretsLoaded = false;
}

function secretsPath(): string {
  if (process.env.HELIX_SECRETS_PATH) return process.env.HELIX_SECRETS_PATH;
  if (process.env.VERCEL) return "/tmp/helix-secrets.json";
  return path.join(process.cwd(), ".data", "secrets.json");
}

function load(): SecretMap {
  if (g.__helixSecretsLoaded && g.__helixSecrets) return g.__helixSecrets;
  g.__helixSecretsLoaded = true;
  try {
    const parsed = JSON.parse(readFileSync(secretsPath(), "utf8")) as SecretMap;
    g.__helixSecrets = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!ALLOWED.has(k) || typeof v !== "string" || !v.trim()) continue;
      g.__helixSecrets[k] = v.trim();
      process.env[k] = v.trim();
    }
  } catch {
    g.__helixSecrets = {};
  }
  return g.__helixSecrets;
}

function persist(map: SecretMap) {
  try {
    const file = secretsPath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(map));
  } catch (err) {
    console.warn("[helix] secrets file skipped:", err instanceof Error ? err.message : err);
  }
}

export function getSecret(name: string): string {
  const fromFile = load()[name];
  if (fromFile) return fromFile;
  return process.env[name]?.trim() || "";
}

export function setSecrets(patch: SecretMap): void {
  const map = load();
  for (const [name, raw] of Object.entries(patch)) {
    if (!ALLOWED.has(name)) continue;
    const value = raw.trim();
    if (!value) {
      delete map[name];
      delete process.env[name];
      continue;
    }
    map[name] = value;
    process.env[name] = value;
  }
  g.__helixSecrets = map;
  persist(map);
  for (const fn of listeners) fn();
}

export function maskSecret(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function secretsPersistKind(): "file" | "memory" {
  try {
    readFileSync(secretsPath());
    return "file";
  } catch {
    return process.env.VERCEL ? "memory" : "file";
  }
}

export function listSecretStatus(fields: SecretField[]): SecretStatus[] {
  return fields.map((field) => {
    const value = getSecret(field.name);
    return {
      ...field,
      configured: Boolean(value),
      masked: maskSecret(value),
    };
  });
}

export async function keysGetResponse(fields: SecretField[]): Promise<Response> {
  return Response.json({
    persist: secretsPersistKind(),
    keys: listSecretStatus(fields),
  });
}

export async function keysPostResponse(req: Request, fields: SecretField[]): Promise<Response> {
  const allowed = new Set(fields.map((f) => f.name));
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON required." }, { status: 400 });
  }
  const patch: SecretMap = {};
  for (const [name, raw] of Object.entries(body)) {
    if (!allowed.has(name) || typeof raw !== "string") continue;
    patch[name] = raw;
  }
  setSecrets(patch);
  return keysGetResponse(fields);
}

export function isGhlConfigured(): boolean {
  return Boolean(getSecret("GHL_API_KEY") && getSecret("GHL_LOCATION_ID"));
}
