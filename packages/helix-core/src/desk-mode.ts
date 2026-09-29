/** `demo` auto-loads catalog samples. Anything else (including unset) starts empty. */
export function autoSeedEnabled(): boolean {
  return (process.env.HELIX_DESK_SEED || "").trim().toLowerCase() === "demo";
}

/**
 * Whether this deployment may show demonstration data at all. On by default so a fresh visitor
 * sees a working desk; a real client deployment sets HELIX_DESK_SEED=off (or "empty") so fake
 * records can never appear in their workspace.
 */
export function demoAvailable(): boolean {
  const v = (process.env.HELIX_DESK_SEED || "").trim().toLowerCase();
  return v !== "off" && v !== "empty";
}

export type DeskMode = "demo" | "live";

/**
 * The single rule every desk uses to decide what the operator sees:
 *  - an integration is connected, or real records exist  -> "live" (demo data is never shown)
 *  - nothing connected and demo is allowed               -> "demo" (sandbox on seed data)
 *  - nothing connected and demo is disabled              -> "live" (an honestly empty desk)
 * Demo and live are exclusive by construction: there is no state that mixes them.
 */
export function resolveDeskMode(input: { connected: boolean; realRecords: number }): DeskMode {
  if (input.connected || input.realRecords > 0) return "live";
  return demoAvailable() ? "demo" : "live";
}

/** Ids of demo records start with this prefix so they can always be told apart from real ones. */
export const DEMO_ID_PREFIX = "seed-";

export function isDemoRecordId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX);
}
