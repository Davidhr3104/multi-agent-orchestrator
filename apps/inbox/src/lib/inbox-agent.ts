import {
  runDeskAction,
  toAnthropicMessages,
  type AgentModel,
  type AgentTool,
  type RiskDecision,
  type ToolCall,
  type UndoEntry,
} from "@helix/core";
import { claudeMessages, INBOX_CLAUDE_MODEL } from "@/lib/ai-usage";
import { inboxActions, type InboxCtx } from "@/lib/ai-actions";
import { guardrailReason } from "@/lib/agent-profile";
import {
  calendarTimeZone,
  eventsWithContact,
  findFreeSlots,
  loadGoogleCalendar,
  type GoogleCalendarEvent,
} from "@/lib/google-calendar";
import { deskAgenda } from "@/lib/showing-schedule";
import { currentDeskMode, getThread, listAllThreads } from "@/lib/store";
import { isTwilioConfigured, sendTwilioMessage } from "@/lib/twilio";
import type { EmailThread } from "@/lib/types";

/**
 * Ask Helix as a tool-use agent. Claude picks the tools; this file decides — in code — which
 * calls run alone and which stop for a person. Sending anything (email, SMS, WhatsApp) is always
 * "confirm": the loop pauses and only the operator's click runs it.
 */

/** Pinned explicitly: helix-core's DEFAULT_AGENT_MODEL is an unverified placeholder. */
export const INBOX_AGENT_MODEL = INBOX_CLAUDE_MODEL;
export const INBOX_AGENT_MAX_STEPS = 8;

export type CalendarSnapshot = {
  source: "google_calendar" | "demo_calendar";
  connected: boolean;
  error: string | null;
  timeZone: string;
  events: GoogleCalendarEvent[];
};

export type InboxAgentCtx = InboxCtx & {
  /** False when a live desk is locked: then even "auto" desk changes wait for a person. */
  canAutoRun: boolean;
  now: Date;
  loadCalendar: (now: Date, days: number) => Promise<CalendarSnapshot>;
};

/** Demo desks read the labelled sample agenda; live desks read the real Google Calendar. */
export async function defaultCalendarLoader(now: Date, days: number): Promise<CalendarSnapshot> {
  if (currentDeskMode() === "demo") {
    const events: GoogleCalendarEvent[] = deskAgenda(now).map((m) => ({
      id: m.id,
      title: m.title,
      start: m.start,
      end: m.end,
      allDay: false,
      busy: true,
      location: m.location,
      htmlLink: m.href,
      organizerEmail: "",
      attendees: [],
    }));
    return { source: "demo_calendar", connected: true, error: null, timeZone: calendarTimeZone(), events };
  }
  const g = await loadGoogleCalendar(now, days);
  return { source: "google_calendar", connected: g.connected, error: g.error, timeZone: g.timeZone, events: g.events };
}

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

function num(input: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const v = Number(input[key]);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

function threadIds(input: Record<string, unknown>): string[] {
  const raw = input.thread_ids;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, 20) : [];
}

function threadSummary(t: EmailThread) {
  return {
    thread_id: t.id,
    from_name: t.fromName,
    from_email: t.fromEmail,
    subject: t.subject,
    snippet: t.body.slice(0, 300),
    received_at: t.receivedAt,
    status: t.status,
    urgency: t.urgencyScore,
    current_draft: t.draftReply ? t.draftReply.slice(0, 400) : null,
  };
}

function localLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function requireThread(id: string): Promise<EmailThread> {
  if (!id) throw new Error("thread_id is required");
  const t = await getThread(id);
  if (!t) throw new Error(`No thread with id "${id}". Use search_threads to find the right id.`);
  return t;
}

function deskChangeRisk(action: string) {
  return async (input: Record<string, unknown>, ctx: InboxAgentCtx): Promise<RiskDecision> => {
    const ids = action === "write_draft" ? [str(input, "thread_id")].filter(Boolean) : threadIds(input);
    if (ids.length === 0) return { level: "deny", reasons: ["No thread id given"] };
    const found = await Promise.all(ids.map((id) => getThread(id)));
    if (found.some((t) => t === null)) return { level: "deny", reasons: ["Unknown thread id; use search_threads to find it"] };
    const assessed = await inboxActions[action].assess(ids, {}, ctx);
    if (assessed.level === "confirm") return { level: "confirm", reasons: assessed.reasons };
    if (!ctx.canAutoRun) return { level: "confirm", reasons: ["The live desk is locked: an operator must approve changes"] };
    return { level: "auto", reasons: assessed.reasons };
  };
}

async function runDeskChange(action: string, ids: string[], params: Record<string, unknown>, ctx: InboxAgentCtx) {
  const r = await runDeskAction(inboxActions, { action, targetIds: ids, params }, ctx);
  if (r.done.length === 0) throw new Error(r.failed[0]?.error ?? "Nothing changed");
  return { output: { result: r.resultText, done: r.done, failed: r.failed }, undo: r.undo as UndoEntry[] };
}

const searchThreads: AgentTool<InboxAgentCtx> = {
  name: "search_threads",
  description:
    "Search the operator's inbox threads by sender name, email address, subject or body words. Returns thread ids, sender, subject, a snippet and any current draft. Use it before acting on any email.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Words to match, e.g. 'Ava' or 'invoice 4471'" },
      limit: { type: "number", description: "Max results (1-10, default 5)" },
    },
    required: ["query"],
  },
  describe: (input) => `Search the inbox for “${str(input, "query")}”`,
  risk: () => ({ level: "auto" }),
  run: async (input) => {
    const terms = str(input, "query").toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (terms.length === 0) throw new Error("query is required");
    const limit = num(input, "limit", 5, 1, 10);
    const scored = (await listAllThreads())
      .map((t) => {
        const who = `${t.fromName} ${t.fromEmail}`.toLowerCase();
        const text = `${t.subject} ${t.body}`.toLowerCase();
        const score = terms.reduce((s, term) => s + (who.includes(term) ? 3 : 0) + (text.includes(term) ? 1 : 0), 0);
        return { t, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.t.receivedAt.localeCompare(a.t.receivedAt))
      .slice(0, limit);
    return { output: { count: scored.length, threads: scored.map((x) => threadSummary(x.t)) } };
  },
};

const findContact: AgentTool<InboxAgentCtx> = {
  name: "find_contact",
  description: "Find a person the operator has email from, by name or email address. Returns their exact email address and their thread ids.",
  inputSchema: {
    type: "object",
    properties: { name_or_email: { type: "string" } },
    required: ["name_or_email"],
  },
  describe: (input) => `Look up the contact “${str(input, "name_or_email")}”`,
  risk: () => ({ level: "auto" }),
  run: async (input) => {
    const needle = str(input, "name_or_email").toLowerCase();
    if (!needle) throw new Error("name_or_email is required");
    const contacts = new Map<string, { name: string; email: string; thread_ids: string[]; last_received_at: string }>();
    for (const t of await listAllThreads()) {
      if (!`${t.fromName} ${t.fromEmail}`.toLowerCase().includes(needle)) continue;
      const key = t.fromEmail.toLowerCase();
      const c = contacts.get(key) ?? { name: t.fromName, email: key, thread_ids: [], last_received_at: t.receivedAt };
      c.thread_ids.push(t.id);
      if (t.receivedAt > c.last_received_at) c.last_received_at = t.receivedAt;
      contacts.set(key, c);
    }
    return { output: { count: contacts.size, contacts: [...contacts.values()].slice(0, 10) } };
  },
};

const calendarLookup: AgentTool<InboxAgentCtx> = {
  name: "calendar_lookup",
  description:
    "Read the operator's calendar (read-only). Returns meetings that include contact_email and free slots in working hours. If connected is false, the calendar could not be read: never invent times in that case.",
  inputSchema: {
    type: "object",
    properties: {
      contact_email: { type: "string", description: "Email of the person to look for in meeting attendees" },
      days_ahead: { type: "number", description: "How far to look (1-30, default 10)" },
      duration_minutes: { type: "number", description: "Length of the slot to find (15-240, default 30)" },
    },
  },
  describe: (input) => (str(input, "contact_email") ? `Check the calendar for ${str(input, "contact_email")}` : "Check the calendar for free time"),
  risk: () => ({ level: "auto" }),
  run: async (input, ctx) => {
    const days = num(input, "days_ahead", 10, 1, 30);
    const duration = num(input, "duration_minutes", 30, 15, 240);
    const cal = await ctx.loadCalendar(ctx.now, days);
    if (!cal.connected) {
      return {
        output: {
          source: cal.source,
          connected: false,
          error: cal.error ?? "No calendar is connected.",
          instruction: "Tell the operator the calendar could not be read. Do not propose specific times.",
        },
      };
    }
    const email = str(input, "contact_email");
    const withContact = email ? eventsWithContact(cal.events, email) : [];
    const slots = findFreeSlots(cal.events, {
      from: ctx.now,
      to: new Date(ctx.now.getTime() + days * 86_400_000),
      durationMinutes: duration,
      timeZone: cal.timeZone,
      limit: 6,
    });
    const view = (e: { start: string; end: string }) => ({ start: e.start, end: e.end, local: localLabel(e.start, cal.timeZone) });
    return {
      output: {
        source: cal.source,
        connected: true,
        ...(cal.source === "demo_calendar" ? { note: "Demo calendar with sample events, not a real calendar." } : {}),
        time_zone: cal.timeZone,
        meetings_with_contact: withContact.map((e) => ({ title: e.title, location: e.location, ...view(e) })),
        upcoming_events: cal.events.length,
        free_slots: slots.map(view),
      },
    };
  },
};

const draftReply: AgentTool<InboxAgentCtx> = {
  name: "draft_reply",
  description:
    "Save the reply text as the thread's draft. Nothing is sent. Write in the operator's voice, use only facts from the thread and from tool results (e.g. real calendar times).",
  inputSchema: {
    type: "object",
    properties: { thread_id: { type: "string" }, text: { type: "string", description: "The full reply body" } },
    required: ["thread_id", "text"],
  },
  describe: (input) => `Write a draft on thread ${str(input, "thread_id")}`,
  risk: deskChangeRisk("write_draft"),
  run: async (input, ctx) => {
    const t = await requireThread(str(input, "thread_id"));
    return runDeskChange("write_draft", [t.id], { text: str(input, "text") }, ctx);
  },
};

const sendReply: AgentTool<InboxAgentCtx> = {
  name: "send_reply",
  description:
    "Send the thread's current draft to the sender. Always requires the operator's confirmation, which the app asks for. Call it only after draft_reply and only when the operator asked you to answer/send.",
  inputSchema: { type: "object", properties: { thread_id: { type: "string" } }, required: ["thread_id"] },
  describe: (input) => `Send the drafted reply on thread ${str(input, "thread_id")}`,
  risk: async (input) => {
    const t = await getThread(str(input, "thread_id"));
    const reasons = [t ? `Emails ${t.fromName || t.fromEmail} <${t.fromEmail}> and cannot be recalled` : "Emails a real person and cannot be recalled"];
    if (t) {
      const held = guardrailReason({ subject: t.subject, body: t.body, draft: t.draftReply });
      if (held) reasons.push(held);
      if (!t.draftReply.trim()) reasons.push("The thread has no draft yet");
    }
    return { level: "confirm", reasons };
  },
  run: async (input, ctx) => {
    const t = await requireThread(str(input, "thread_id"));
    if (!t.draftReply.trim()) throw new Error("This thread has no draft to send.");
    const r = await runDeskAction(inboxActions, { action: "send_reply", targetIds: [t.id] }, ctx);
    if (r.done.length === 0) throw new Error(r.failed[0]?.error ?? "Send failed");
    return { output: { result: r.resultText, demo: currentDeskMode() === "demo" } };
  },
};

const sendMessage: AgentTool<InboxAgentCtx> = {
  name: "send_message",
  description:
    "Send an SMS or WhatsApp message through Twilio. Always requires the operator's confirmation. Only use when the operator explicitly asks for SMS/WhatsApp and gives or confirms the phone number.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Phone in E.164 format, e.g. +5215512345678" },
      body: { type: "string" },
      channel: { type: "string", enum: ["sms", "whatsapp"] },
    },
    required: ["to", "body", "channel"],
  },
  describe: (input) => `Send a ${str(input, "channel") === "whatsapp" ? "WhatsApp" : "SMS"} to ${str(input, "to")}: “${str(input, "body").slice(0, 160)}”`,
  risk: () => ({
    level: "confirm",
    reasons: [isTwilioConfigured() ? "Messages a real phone and cannot be recalled" : "Twilio is not connected; this will fail"],
  }),
  run: async (input) => {
    if (currentDeskMode() === "demo") return { output: { sent: false, demo: true, result: "Demo desk: nothing was sent through Twilio." } };
    const channel = str(input, "channel") === "whatsapp" ? "whatsapp" : "sms";
    const r = await sendTwilioMessage({ to: str(input, "to"), body: str(input, "body"), channel });
    if (!r.ok) throw new Error(r.error);
    return { output: { accepted_by_twilio: true, sid: r.sid, twilio_status: r.status, note: "Twilio accepted the message; delivery is not confirmed yet." } };
  },
};

function deskTool(action: "snooze_threads" | "archive_threads" | "route_threads", verb: string): AgentTool<InboxAgentCtx> {
  return {
    name: action.replace("_threads", "_thread"),
    description: `${verb} one or more threads by id. Reversible; risky cases (urgent, awaiting review, bulk) stop for confirmation.`,
    inputSchema: {
      type: "object",
      properties: { thread_ids: { type: "array", items: { type: "string" } } },
      required: ["thread_ids"],
    },
    describe: (input) => `${verb} ${threadIds(input).length} thread(s)`,
    risk: deskChangeRisk(action),
    run: async (input, ctx) => {
      const ids = threadIds(input);
      if (ids.length === 0) throw new Error("thread_ids is required");
      return runDeskChange(action, ids, {}, ctx);
    },
  };
}

export const INBOX_AGENT_TOOLS: AgentTool<InboxAgentCtx>[] = [
  searchThreads,
  findContact,
  calendarLookup,
  draftReply,
  sendReply,
  sendMessage,
  deskTool("snooze_threads", "Snooze"),
  deskTool("archive_threads", "Archive"),
  deskTool("route_threads", "Route to the owner"),
];

export function inboxAgentSystem(now: Date, mode: "demo" | "live"): string {
  return `You are Ask Helix inside Helix for Inbox, the email desk of an executive assistant. Today is ${now.toISOString()} (operator time zone: ${calendarTimeZone()}).
${mode === "demo" ? "This is the DEMO desk with sample data. Sending only marks a thread as sent; nothing is emailed. Say so when you send." : "This is the LIVE desk with the operator's real mail."}

How to work:
- To act on "X wrote me": find_contact / search_threads first, then read the thread snippet. Never guess a thread id.
- For anything about meetings or availability, call calendar_lookup with the contact's email. Use only the times it returns, quoted in the calendar's time zone. If it says connected=false, say the calendar could not be read and do not propose times.
- To answer someone: call draft_reply with the full text, then send_reply only if the operator asked you to answer or send. The app shows the operator a confirmation; nothing is sent until they approve.
- Never say an email or message was sent unless a tool result says so. In demo, say it was only marked as sent.
- Do not invent prices, commitments or facts that are not in the thread or a tool result.
- Answer in the operator's language, briefly. When you stop for a confirmation, show the draft text you prepared.`;
}

function toolDefsForAnthropic(tools: { name: string; description: string; inputSchema: Record<string, unknown> }[]) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
}

/**
 * helix-core's transcript mapper turns an assistant turn with no text and no tool calls into
 * content "", which Anthropic rejects; such turns carry nothing, so they are dropped.
 */
export function anthropicTranscript(messages: Parameters<typeof toAnthropicMessages>[0]) {
  return toAnthropicMessages(messages).filter((m) => !(m.role === "assistant" && (m.content === "" || (Array.isArray(m.content) && m.content.length === 0))));
}

/** AgentModel on the tracked Claude client, so every agent turn's tokens and estimated cost are recorded. */
export function inboxAgentModel(model: string = INBOX_AGENT_MODEL): AgentModel {
  return async ({ system, messages, tools }) => {
    const { content, text } = await claudeMessages({
      purpose: "agent",
      model,
      maxTokens: 1500,
      system,
      messages: anthropicTranscript(messages),
      tools: toolDefsForAnthropic(tools),
      timeoutMs: 30_000,
    });
    const toolCalls: ToolCall[] = content
      .filter((b) => b.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string")
      .map((b) => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));
    return { text: text || undefined, toolCalls };
  };
}
