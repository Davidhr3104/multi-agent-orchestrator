import { getSecret } from "@helix/core";
import { currentDeskMode, getPreferences, updatePreferences } from "@/lib/store";
import { isSlackConfigured } from "@/lib/slack";
import { isTwilioConfigured } from "@/lib/twilio";
import type { DeskConnections } from "./catalog";
import { MAX_DEMO_AUTOMATIONS, MAX_LIVE_AUTOMATIONS, emptyState, type AutomationState } from "./service";

/**
 * Where a desk's automations live.
 *   live desk  → Supabase, inside the existing preferences JSON (no new table), so a scheduled run can read them.
 *   demo desk  → a cookie in the visitor's browser, like the rest of the demo desk. Nothing is written to
 *                Supabase and nothing is ever really sent; a cron cannot see a cookie, so demo runs are previews.
 */

export const AUTO_COOKIE = "helix_inbox_auto_v1";
const COOKIE_MAX_CHARS = 3600;

type CookieShape = { v: 1; automations: AutomationState["automations"]; runs: AutomationState["runs"]; timezone: string | null };

function readCookieHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export function readAutomationCookie(req: Request): AutomationState {
  const raw = readCookieHeader(req.headers.get("cookie"), AUTO_COOKIE);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CookieShape;
    if (parsed?.v !== 1 || !Array.isArray(parsed.automations)) return emptyState();
    return { automations: parsed.automations, runs: Array.isArray(parsed.runs) ? parsed.runs : [], timezone: parsed.timezone ?? null };
  } catch {
    return emptyState();
  }
}

/** Run text can be long, so the cookie keeps only the outcome; the full text of a run is shown once, in the response. */
function slimRun(run: AutomationState["runs"][number]): AutomationState["runs"][number] {
  return { ...run, text: undefined, error: run.error ? run.error.slice(0, 140) : undefined };
}

export function automationCookieHeader(state: AutomationState): string {
  let runs = state.runs.map(slimRun);
  const build = () => encodeURIComponent(JSON.stringify({ v: 1, automations: state.automations, runs, timezone: state.timezone } satisfies CookieShape));
  let value = build();
  // Oldest history goes first. Automations never do: losing one silently would be worse than refusing the change.
  while (value.length > COOKIE_MAX_CHARS && runs.length > 0) {
    runs = runs.slice(0, -1);
    value = build();
  }
  if (value.length > COOKIE_MAX_CHARS) throw new Error("The demo desk has no room left to store this automation. Delete one first.");
  return `${AUTO_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; HttpOnly`;
}

export type AutomationAccess = {
  readonly mode: "demo" | "live";
  readonly limit: number;
  load(): Promise<AutomationState>;
  save(next: AutomationState): Promise<void>;
  /** True when a demo save is waiting to be written as a cookie on the response. */
  readonly dirty: boolean;
  /** The last state saved in this request (what the cookie must contain). */
  readonly current: AutomationState | null;
};

export function automationAccess(req: Request): AutomationAccess {
  const mode = currentDeskMode();
  let last: AutomationState | null = null;
  let dirty = false;
  return {
    mode,
    limit: mode === "demo" ? MAX_DEMO_AUTOMATIONS : MAX_LIVE_AUTOMATIONS,
    get dirty() {
      return dirty;
    },
    get current() {
      return last;
    },
    async load() {
      if (last) return last;
      if (mode === "demo") return (last = readAutomationCookie(req));
      const prefs = await getPreferences();
      return (last = { automations: prefs.automations ?? [], runs: prefs.automationRuns ?? [], timezone: prefs.automationTimezone ?? null });
    },
    async save(next) {
      last = next;
      if (mode === "demo") {
        automationCookieHeader(next); // throws now, in the request that caused it, if it cannot fit
        dirty = true;
        return;
      }
      await updatePreferences({ automations: next.automations, automationRuns: next.runs, automationTimezone: next.timezone });
    },
  };
}

/** Adds the demo cookie to a response when this request changed the state. */
export function withAutomationCookie(res: Response, access: AutomationAccess): Response {
  if (access.dirty && access.current) res.headers.append("Set-Cookie", automationCookieHeader(access.current));
  return res;
}

export function deskConnections(): DeskConnections {
  return { slack: isSlackConfigured(), twilio: isTwilioConfigured() };
}

export function cronConfigured(): boolean {
  return Boolean(getSecret("CRON_SECRET"));
}
