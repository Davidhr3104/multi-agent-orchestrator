import {
  deriveStatus,
  isE164,
  isValidTimeZone,
  validateSpec,
  type AutomationRun,
  type AutomationSpec,
  type Requirement,
  type Trigger,
  type Validation,
  type ValidationContext,
} from "@helix/core/automations";
import { CHANNEL_LABEL, SOURCES } from "./catalog";

/**
 * Pure state transitions for a desk's automations. Every change re-derives `status` and `missing` from the
 * facts (what is connected, what is saved, whether the person confirmed), so nothing can claim to be active
 * that is not. Storage and HTTP live elsewhere.
 */

export type AutomationState = { automations: AutomationSpec[]; runs: AutomationRun[]; timezone: string | null };

export const emptyState = (): AutomationState => ({ automations: [], runs: [], timezone: null });

/** The demo desk keeps state in a cookie (about 4 KB), so it holds a handful. A live desk has no such cap. */
export const MAX_DEMO_AUTOMATIONS = 4;
export const MAX_LIVE_AUTOMATIONS = 25;
export const MAX_RUNS = 20;

function revalidate(spec: AutomationSpec, ctx: ValidationContext, now: Date): { spec: AutomationSpec; validation: Validation } {
  let trigger: Trigger = spec.trigger;
  if (trigger.kind === "daily" && !isValidTimeZone(trigger.tz) && isValidTimeZone(ctx.settings.timezone)) {
    trigger = { ...trigger, tz: ctx.settings.timezone as string };
  }
  const next: AutomationSpec = { ...spec, trigger };
  const validation = validateSpec(next, ctx);
  const status = deriveStatus(spec.status === "paused" ? "paused" : "active", validation, Boolean(spec.confirmedAt));
  return { spec: { ...next, status, missing: validation.missing, updatedAt: now.toISOString() }, validation };
}

function replace(state: AutomationState, spec: AutomationSpec): AutomationState {
  return { ...state, automations: state.automations.map((a) => (a.id === spec.id ? spec : a)) };
}

function find(state: AutomationState, id: string): AutomationSpec {
  const spec = state.automations.find((a) => a.id === id);
  if (!spec) throw new Error(`Automation "${id}" was not found.`);
  return spec;
}

export function createAutomation(
  state: AutomationState,
  draft: AutomationSpec,
  ctx: ValidationContext,
  opts: { confirm: boolean; now: Date; limit: number }
): { state: AutomationState; spec: AutomationSpec; validation: Validation } {
  const userCount = state.automations.filter((a) => a.origin === "user").length;
  if (userCount >= opts.limit) throw new Error(`Automation limit reached (${opts.limit}). Delete one before creating another.`);
  if (state.automations.some((a) => a.id === draft.id)) throw new Error(`Automation "${draft.id}" already exists.`);
  const base: AutomationSpec = { ...draft, status: "draft", confirmedAt: opts.confirm ? opts.now.toISOString() : null };
  const { spec, validation } = revalidate(base, ctx, opts.now);
  if (validation.errors.length) throw new Error(`This automation cannot be created: ${validation.errors.join(" ")}`);
  return { state: { ...state, automations: [...state.automations, spec] }, spec, validation };
}

export function confirmAutomation(state: AutomationState, id: string, ctx: ValidationContext, now: Date): AutomationState {
  const spec = find(state, id);
  return replace(state, revalidate({ ...spec, confirmedAt: spec.confirmedAt ?? now.toISOString() }, ctx, now).spec);
}

export function setPaused(state: AutomationState, id: string, paused: boolean, ctx: ValidationContext, now: Date): AutomationState {
  const spec = find(state, id);
  return replace(state, revalidate({ ...spec, status: paused ? "paused" : "draft" }, ctx, now).spec);
}

export function removeAutomation(state: AutomationState, id: string): AutomationState {
  find(state, id);
  return { ...state, automations: state.automations.filter((a) => a.id !== id) };
}

export function setTimezone(state: AutomationState, tz: string, ctx: ValidationContext, now: Date): AutomationState {
  if (!isValidTimeZone(tz)) throw new Error(`"${tz}" is not a valid time zone (use a name like America/Mexico_City).`);
  const next: ValidationContext = { ...ctx, settings: { ...ctx.settings, timezone: tz } };
  const automations = state.automations.map((a) => {
    const t: Trigger = a.trigger.kind === "daily" && !isValidTimeZone(a.trigger.tz) ? { ...a.trigger, tz } : a.trigger;
    return revalidate({ ...a, trigger: t }, next, now).spec;
  });
  return { ...state, timezone: tz, automations };
}

export function setRecipient(state: AutomationState, id: string, rawPhone: string, ctx: ValidationContext, now: Date): AutomationState {
  const cleaned = `+${rawPhone.replace(/\D/g, "")}`;
  if (!isE164(cleaned)) throw new Error("That is not a valid phone number. Use the international format, e.g. +5215512345678.");
  const spec = find(state, id);
  const steps = spec.steps.map((s) => (s.type === "send" && (s.channel === "whatsapp" || s.channel === "sms") ? { ...s, to: cleaned } : s));
  return replace(state, revalidate({ ...spec, steps }, ctx, now).spec);
}

/** Revalidates everything against the current connections, e.g. after the person connected a tool. */
export function revalidateAll(state: AutomationState, ctx: ValidationContext, now: Date): AutomationState {
  return { ...state, automations: state.automations.map((a) => revalidate(a, ctx, now).spec) };
}

export function recordRun(state: AutomationState, run: AutomationRun): AutomationState {
  return { ...state, runs: [run, ...state.runs].slice(0, MAX_RUNS) };
}

/** Keys of scheduled runs already recorded: a run is never owed twice, even if it failed (no silent resend). */
export function doneKeys(state: AutomationState): Set<string> {
  return new Set(state.runs.filter((r) => r.trigger === "schedule").map((r) => r.key));
}

export function clock12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function describeSchedule(trigger: Trigger): string {
  if (trigger.kind === "manual") return "when you run it";
  return `every day at ${clock12(trigger.time)} (${trigger.tz || "time zone not set"})`;
}

function requirementLine(r: Requirement): string {
  if (r.kind === "connection") return `• Connect ${r.label} — [Connect](${r.connectUrl})`;
  if (r.kind === "setting") return `• Set your ${r.label.toLowerCase()} — [Set it](${r.settingsUrl})`;
  return `• Add your ${r.label} — [Add it](/automations)`;
}

/**
 * What Helix says after creating one. Built only from the validated spec: it says "active" only when the
 * facts say so, names exactly what the message contains, and otherwise lists what is still missing.
 */
export function chatReply(spec: AutomationSpec, validation: Validation): string {
  const sources = spec.steps.flatMap((s) => (s.type === "source" ? [SOURCES[s.node]] : [])).filter(Boolean);
  const channels = spec.steps.flatMap((s) => (s.type === "send" ? [CHANNEL_LABEL[s.channel]] : []));
  const includes = [...new Set(sources.flatMap((s) => s.includes))];
  const what = `${includes.join(", ")}`;
  const link = `[Review the automation](/automations#${spec.id})`;
  if (spec.status === "active" && validation.ok) {
    return `Done — "${spec.name}" is active — ${describeSchedule(spec.trigger)}. I'll send ${channels.join(" and ")} a message with ${what}. ${link}. If you need anything else, tell me.`;
  }
  const lines = spec.missing.map(requirementLine);
  return `I prepared "${spec.name}", but it is not active yet. It would send ${channels.join(" and ")} a message ${describeSchedule(spec.trigger)} with ${what}. To turn it on you still need to:\n${lines.join("\n")}\nNothing will be sent until then. ${link}`;
}
