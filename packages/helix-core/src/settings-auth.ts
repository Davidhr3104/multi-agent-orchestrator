import {
  OPERATOR_COOKIE,
  operatorCookieMatches,
  operatorKeyConfigured,
  readCookie,
  verifyOperatorKey,
} from "./operator";

export type SettingsAuthOptions = {
  /**
   * True when the app has already authenticated this caller (a signed-in
   * Supabase user). Helix-core does not read session cookies itself.
   */
  session?: boolean;
};

/**
 * Operator credential or an app session. A `?t=` value that only looks like
 * an action token does not count: settings routes never verify that token,
 * so treating its shape as auth would let anyone write keys.
 */
export function settingsPrivileged(req: Request, opts?: SettingsAuthOptions): boolean {
  if (opts?.session) return true;
  if (!operatorKeyConfigured()) return false;

  const cookie = readCookie(req.headers.get("cookie"), OPERATOR_COOKIE);
  if (operatorCookieMatches(cookie)) return true;

  const headerKey = req.headers.get("x-helix-operator-key")?.trim() ?? "";
  if (headerKey && verifyOperatorKey(headerKey)) return true;

  const ops = new URL(req.url).searchParams.get("ops")?.trim() ?? "";
  if (ops && operatorCookieMatches(ops)) return true;

  return false;
}

export function settingsWriteDenied(req: Request, opts?: SettingsAuthOptions): Response | null {
  if (settingsPrivileged(req, opts)) return null;
  if (!operatorKeyConfigured()) {
    return Response.json(
      { error: "Settings are read-only until HELIX_OPERATOR_KEY is set on the server." },
      { status: 403 }
    );
  }
  return Response.json({ error: "Operator unlock required." }, { status: 401 });
}

/**
 * Reloading the in-memory demo catalog is part of the public demo and does not
 * write secrets. Every other settings mutation needs a real credential.
 * Handlers must still refuse to load demo data over a live desk.
 */
export function settingsDeskWriteDenied(
  req: Request,
  action: string | undefined,
  opts?: SettingsAuthOptions
): Response | null {
  if (action === "demo") return null;
  return settingsWriteDenied(req, opts);
}

/** Drop integration flags a public desk read does not need (connected, store backend, supabase). */
export function redactDeskStatus<T extends object>(status: T, privileged: boolean): T {
  if (privileged) return status;
  const next = { ...status } as T & { connected?: boolean; store?: string; supabase?: boolean };
  if ("connected" in next) next.connected = false;
  if ("store" in next) next.store = "memory";
  if ("supabase" in next) next.supabase = false;
  return next;
}
