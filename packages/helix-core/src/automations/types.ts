/**
 * Helix Automations: a small, closed, serialisable description of "do X on a schedule and send it to Y".
 * The AI only ever produces one of these from a sentence; validating, scheduling, building the content and
 * sending are plain code. See docs/superpowers/specs/2026-10-06-helix-automations-design.md.
 */

export type Channel = "in_app" | "slack" | "whatsapp" | "sms" | "email";

export type Trigger =
  | { kind: "daily"; /** "HH:MM", 24h, in `tz` */ time: string; /** IANA zone, e.g. America/Mexico_City */ tz: string }
  | { kind: "manual" };

export type SourceStep = { type: "source"; node: string };
/** `to` is the recipient for phone channels (E.164). Slack and in-app need none. */
export type SendStep = { type: "send"; channel: Channel; to?: string };
export type Step = SourceStep | SendStep;

/** Something the user must still do before the automation can run. Each one carries where to do it. */
export type Requirement =
  | { kind: "connection"; tool: string; label: string; connectUrl: string }
  | { kind: "setting"; key: "timezone"; label: string; settingsUrl: string }
  | { kind: "recipient"; channel: Channel; label: string };

export type AutomationStatus = "draft" | "active" | "paused";

export type AutomationSpec = {
  id: string;
  name: string;
  /** builtin ships with the Helix; user was created by the person (chat or canvas). */
  origin: "builtin" | "user";
  status: AutomationStatus;
  trigger: Trigger;
  steps: Step[];
  createdBy: "chat" | "canvas" | "seed";
  createdAt: string;
  updatedAt: string;
  /** When the person explicitly confirmed it (and so consented to the sends). Null = never confirmed. */
  confirmedAt: string | null;
  /** What still blocks activation. Empty when status is active. */
  missing: Requirement[];
};

export type RunStatus = "ok" | "failed" | "skipped" | "expired";

export type AutomationRun = {
  id: string;
  automationId: string;
  /** automationId@scheduledFor for scheduled runs: the idempotency key. Manual runs use a unique key. */
  key: string;
  scheduledFor: string | null;
  startedAt: string;
  finishedAt: string;
  status: RunStatus;
  trigger: "schedule" | "manual";
  /** True when nothing was really sent (demo desk or "run now" preview). */
  preview: boolean;
  error?: string;
  /** The exact text that was (or would have been) delivered. */
  text?: string;
  delivered?: Channel[];
};
