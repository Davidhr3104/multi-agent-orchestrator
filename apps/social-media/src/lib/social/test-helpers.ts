import type { FetchLike } from "./config";

export type Call = { url: string; method: string; headers: Record<string, string>; body: string };

type Route = (call: Call) => Response | undefined;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** A fetch double that records every call and answers from the first matching route. Unmatched calls fail loudly. */
export function mockFetch(...routes: Route[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (input, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: Call = { url: String(input), method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : "" };
    calls.push(call);
    for (const route of routes) {
      const res = route(call);
      if (res) return res;
    }
    throw new Error(`Unexpected request: ${call.method} ${call.url}`);
  };
  return { fetch, calls };
}

const KEYS = [
  "HELIX_META_ACCESS_TOKEN",
  "HELIX_META_PAGE_ACCESS_TOKEN",
  "HELIX_META_PAGE_ID",
  "HELIX_META_IG_USER_ID",
  "HELIX_META_GRAPH_VERSION",
  "HELIX_LINKEDIN_ACCESS_TOKEN",
  "HELIX_LINKEDIN_ORGANIZATION_URN",
  "HELIX_LINKEDIN_VERSION",
  "HELIX_SOCIAL_PUBLISH",
  "HELIX_DESK_SEED",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
  "HELIX_SECRETS_PATH",
];

/** Snapshot of the env vars these tests touch, with a restore function. */
export function saveEnv(): () => void {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  process.env.HELIX_SECRETS_PATH = "./.data/__no-secrets-in-tests__.json";
  return () => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}
