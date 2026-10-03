/** Client-side desk preferences (defense switches, automation arms, HITL snoozes). */

const PREFIX = "helix.marketing.";

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export type DefenseSwitches = { pause: boolean; capi: boolean; slack: boolean };

export function loadDefenseSwitches(): DefenseSwitches {
  return loadJson("defense.switches", { pause: true, capi: true, slack: true });
}

export function saveDefenseSwitches(v: DefenseSwitches) {
  saveJson("defense.switches", v);
}

export function isSnoozed(id: string): boolean {
  const until = loadJson<Record<string, number>>("hitl.snooze", {})[id];
  return typeof until === "number" && until > Date.now();
}

export function snoozeId(id: string, hours = 4) {
  const map = loadJson<Record<string, number>>("hitl.snooze", {});
  map[id] = Date.now() + hours * 60 * 60 * 1000;
  saveJson("hitl.snooze", map);
}

export function loadArmedRules(defaults: Record<string, boolean>): Record<string, boolean> {
  return { ...defaults, ...loadJson<Record<string, boolean>>("automations.armed", {}) };
}

export function saveArmedRule(id: string, armed: boolean) {
  const map = loadJson<Record<string, boolean>>("automations.armed", {});
  map[id] = armed;
  saveJson("automations.armed", map);
}

/** The analysis window chosen on any page ("7d" by default); every page reads the same one. */
export function deskWindow(): "7d" | "30d" | "90d" {
  const w = loadJson<string>("window", "7d");
  return w === "30d" || w === "90d" ? w : "7d";
}
