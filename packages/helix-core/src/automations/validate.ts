import { isValidTimeZone, parseClock } from "./schedule";
import type { AutomationSpec, AutomationStatus, Channel, Requirement } from "./types";

export type NodeDef = { kind: "source"; label: string };

export type ChannelInfo = {
  tool: string;
  label: string;
  connected: boolean;
  /** Where the Connect button sends the person. */
  connectUrl: string;
  needsRecipient: boolean;
};

export type ValidationContext = {
  nodes: Record<string, NodeDef>;
  channels: Partial<Record<Channel, ChannelInfo>>;
  settings: { timezone: string | null };
  /** Where the timezone is set. Defaults to /automations. */
  settingsUrl?: string;
};

export type Validation = {
  ok: boolean;
  /** The spec itself is wrong (unknown node, bad time): it cannot be saved. */
  errors: string[];
  /** The spec is fine but the desk is not ready: it is kept as a draft with this list. */
  missing: Requirement[];
};

const E164 = /^\+[1-9]\d{6,14}$/;

export function isE164(value: string | undefined): boolean {
  return Boolean(value && E164.test(value));
}

/**
 * Pure pre-flight. No AI, no network: it only compares the spec with what the desk has connected, so the
 * chat answer ("it's active" vs "connect these first") is derived from facts, never from intent.
 */
export function validateSpec(spec: AutomationSpec, ctx: ValidationContext): Validation {
  const errors: string[] = [];
  const missing: Requirement[] = [];
  const seen = new Set<string>();
  const add = (key: string, req: Requirement) => {
    if (seen.has(key)) return;
    seen.add(key);
    missing.push(req);
  };

  const sources = spec.steps.filter((s) => s.type === "source");
  const sends = spec.steps.filter((s) => s.type === "send");
  if (sources.length === 0) errors.push("At least one source step is required.");
  if (sends.length === 0) errors.push("At least one send step is required.");

  for (const step of spec.steps) {
    if (step.type === "source" && !ctx.nodes[step.node]) errors.push(`Unknown source "${step.node}".`);
  }

  if (spec.trigger.kind === "daily") {
    if (!parseClock(spec.trigger.time)) errors.push(`Invalid time of day "${spec.trigger.time}" (expected HH:MM).`);
    if (!isValidTimeZone(ctx.settings.timezone) || !isValidTimeZone(spec.trigger.tz)) {
      add("setting:timezone", { kind: "setting", key: "timezone", label: "Time zone", settingsUrl: ctx.settingsUrl ?? "/automations" });
    }
  }

  for (const step of sends) {
    if (step.type !== "send") continue;
    const info = ctx.channels[step.channel];
    if (!info) {
      errors.push(`Unknown channel "${step.channel}".`);
      continue;
    }
    if (!info.connected) add(`connection:${info.tool}`, { kind: "connection", tool: info.tool, label: info.label, connectUrl: info.connectUrl });
    if (info.needsRecipient && !isE164(step.to)) add(`recipient:${step.channel}`, { kind: "recipient", channel: step.channel, label: `${info.label} number` });
  }

  return { ok: errors.length === 0 && missing.length === 0, errors, missing };
}

/** Helix only says "active" when nothing is missing AND the person confirmed. Otherwise it is a draft. */
export function deriveStatus(requested: Exclude<AutomationStatus, "draft">, validation: Validation, confirmed: boolean): AutomationStatus {
  if (requested === "paused") return "paused";
  return validation.ok && confirmed ? "active" : "draft";
}
