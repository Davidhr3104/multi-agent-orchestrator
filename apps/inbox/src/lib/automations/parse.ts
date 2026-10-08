import type { AutomationSpec, Channel, Step } from "@helix/core/automations";
import { CHANNEL_LABEL, SOURCES } from "./catalog";

/**
 * Turns a sentence into the fields of an automation. Deterministic on purpose: the demo assistant uses it
 * as-is, and when Claude is on its proposal is checked against the same catalog. It never guesses a time and
 * never picks an outside channel the person did not name.
 */

export type ParsedRequest = {
  source: keyof typeof SOURCES & string;
  channel: Channel;
  channelWasDefault: boolean;
  /** "HH:MM" 24h, or null when the sentence gave none (the caller asks instead of guessing). */
  time: string | null;
  /** Phone for whatsapp/sms, E.164, when one was written in the sentence. */
  to?: string;
};

const RECURRING = /\b(every ?day|everyday|daily|each day|every (morning|evening|night)|cada d[ií]a|todos los d[ií]as|diari[oa]mente|a diario)\b/;
const NOTIFY = /\b(send|text|message|notify|tell|dm|ping|m[aá]nda(me)?|env[ií]a(me)?|avisa(me)?|dime)\b/;
const SUBJECT = /\b(summary|digest|report|recap|breach|sla|resumen|reporte|informe)\b/;

function parseTime(q: string): string | null {
  const ampm = /\b(?:at |a las |a la )?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/.exec(q);
  if (ampm) {
    let h = Number(ampm[1]);
    const min = ampm[2] ? Number(ampm[2]) : 0;
    const pm = ampm[3].startsWith("p");
    if (h < 1 || h > 12 || min > 59) return null;
    if (h === 12) h = 0;
    if (pm) h += 12;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const h24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(q);
  if (h24) return `${h24[1].padStart(2, "0")}:${h24[2]}`;
  return null;
}

function parseChannel(q: string): { channel: Channel; wasDefault: boolean } {
  if (/whats ?app/.test(q)) return { channel: "whatsapp", wasDefault: false };
  if (/\bslack\b/.test(q)) return { channel: "slack", wasDefault: false };
  if (/\b(sms|text message|texto)\b/.test(q)) return { channel: "sms", wasDefault: false };
  return { channel: "in_app", wasDefault: true };
}

function parsePhone(raw: string): string | undefined {
  const m = /\+\d[\d\s().-]{6,18}\d/.exec(raw);
  if (!m) return undefined;
  const cleaned = `+${m[0].replace(/\D/g, "")}`;
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : undefined;
}

export function parseAutomationRequest(text: string): ParsedRequest | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  // "send Maya Chen the reply" and "summarize my inbox" are commands/questions, not routines.
  if (!RECURRING.test(q) && !/\b(a las|at) \d{1,2}/.test(q)) return null;
  if (!NOTIFY.test(q) && !RECURRING.test(q)) return null;
  if (!SUBJECT.test(q)) return null;

  const { channel, wasDefault } = parseChannel(q);
  // \bsla\b, not a prefix: "slack" must not read as an SLA request.
  const source = /\b(sla|breach(?:es|ed)?|incumpl\w*)\b/.test(q) ? "inbox.sla_breaches" : "inbox.daily_digest";
  return { source, channel, channelWasDefault: wasDefault, time: parseTime(q), to: parsePhone(text) };
}

export function buildSpec(parsed: ParsedRequest, opts: { tz: string | null; now: Date; id: string }): AutomationSpec {
  if (!parsed.time) throw new Error("A daily automation needs a time of day.");
  const iso = opts.now.toISOString();
  const send: Step = parsed.to ? { type: "send", channel: parsed.channel, to: parsed.to } : { type: "send", channel: parsed.channel };
  return {
    id: opts.id,
    name: `${SOURCES[parsed.source].label} → ${CHANNEL_LABEL[parsed.channel]}`,
    origin: "user",
    status: "draft",
    trigger: { kind: "daily", time: parsed.time, tz: opts.tz ?? "" },
    steps: [{ type: "source", node: parsed.source }, send],
    createdBy: "chat",
    createdAt: iso,
    updatedAt: iso,
    confirmedAt: null,
    missing: [],
  };
}
