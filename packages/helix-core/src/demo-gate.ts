import { resolveDeskMode, type DeskMode } from "./desk-mode";

/**
 * Per-desk switch between the demo sandbox and live data, for single-tenant desks (Inbox, Commerce,
 * Marketing, Legal). While the desk is in demo mode the app's Supabase client is *suspended*: every
 * read and write behaves as if Supabase were not configured, so demo records can never be persisted
 * and can never be mistaken for real ones. Going live un-suspends it.
 *
 * State lives on globalThis so it survives Next.js module re-evaluation, like the desks' own memory.
 */
export type DemoGate = {
  /** True while demo mode is active — the app's Supabase layer must treat itself as unavailable. */
  suspended(): boolean;
  mode(): DeskMode | "unknown";
  /**
   * Decide the mode. `remoteRecords` is the number of real rows found in Supabase (0 if not configured).
   * Returns true when the mode changed since the last call, so the caller knows to reload its memory.
   */
  evaluate(input: { connected: boolean; remoteRecords: number }): boolean;
  /** Operator explicitly chose to start with their own data (used where no API exists to connect). */
  goLive(): void;
  /** Forget everything — for tests and for "Reset demo". */
  reset(): void;
};

type GateState = { mode: DeskMode | "unknown"; forcedLive: boolean };

export function createDemoGate(name: string): DemoGate {
  const g = globalThis as typeof globalThis & { __helixDemoGate?: Record<string, GateState> };
  g.__helixDemoGate ??= {};
  const state = (g.__helixDemoGate[name] ??= { mode: "unknown", forcedLive: false });

  return {
    suspended: () => state.mode === "demo",
    mode: () => state.mode,
    evaluate({ connected, remoteRecords }) {
      const next: DeskMode = state.forcedLive
        ? "live"
        : resolveDeskMode({ connected, realRecords: remoteRecords });
      const changed = state.mode !== next;
      state.mode = next;
      return changed;
    },
    goLive() {
      state.forcedLive = true;
    },
    reset() {
      state.mode = "unknown";
      state.forcedLive = false;
    },
  };
}
