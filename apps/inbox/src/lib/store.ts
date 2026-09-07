import type { AiActionLog, DraftTone, EmailThread, ThreadMessage, UserPreferences } from "@/lib/types";
import {
  DEFAULT_ACCOUNT_ID,
  DEFAULT_TO_EMAIL,
  DEFAULT_WORKSPACE_ID,
  toInboxMessage,
  type InboxMessage,
} from "@/lib/types";
import { suggestSnoozeUntil, triageHeuristic } from "@/lib/triage";
import { smartReplyWithContext } from "@/lib/smart-reply";
import {
  isSupabaseConfigured,
  supabaseGetPreferences,
  supabaseInsertAiLog,
  supabaseListAiLogs,
  supabaseListThreadMessages,
  supabaseListThreads,
  supabaseUpsertPreferences,
  supabaseUpsertThread,
  supabaseUpsertThreadMessages,
  supabaseUpsertThreads,
} from "@/lib/supabase-desk";

export type { InboxMessage, EmailThread, ThreadMessage, AiActionLog, UserPreferences } from "@/lib/types";
export { toInboxMessage, categoryLabel } from "@/lib/types";

const threads = new Map<string, EmailThread>();
const messages = new Map<string, ThreadMessage[]>();
const aiLogs: AiActionLog[] = [];
let prefs: UserPreferences = {
  id: "pref-northwind",
  workspaceId: DEFAULT_WORKSPACE_ID,
  autoTriage: true,
  defaultTone: "professional",
  vipSenders: ["maya@northwindhvac.com"],
  theme: "dark",
  customRules: [
    {
      id: "rule-amount",
      ifContains: "1000",
      then: "urgent",
      enabled: true,
    },
  ],
  templates: [
    {
      id: "tpl-ack",
      name: "Acknowledgement",
      body: "Thanks for reaching out — we received your note and will follow up shortly.",
    },
    {
      id: "tpl-meeting",
      name: "Meeting offer",
      body: "Happy to find time this week. Does Tuesday or Thursday afternoon work on your side?",
    },
  ],
};
let seeded = false;
let remoteBootstrapped = false;

function nowIso() {
  return new Date().toISOString();
}

function makeThread(
  partial: Omit<
    EmailThread,
    | "workspaceId"
    | "emailAccountId"
    | "toEmail"
    | "snippet"
    | "draftTone"
    | "isRead"
    | "isStarred"
    | "receivedAt"
    | "externalThreadId"
  > &
    Partial<
      Pick<
        EmailThread,
        | "workspaceId"
        | "emailAccountId"
        | "toEmail"
        | "snippet"
        | "draftTone"
        | "isRead"
        | "isStarred"
        | "receivedAt"
        | "externalThreadId"
      >
    >
): EmailThread {
  const body = partial.body;
  return {
    workspaceId: DEFAULT_WORKSPACE_ID,
    emailAccountId: DEFAULT_ACCOUNT_ID,
    externalThreadId: partial.externalThreadId ?? partial.id,
    toEmail: DEFAULT_TO_EMAIL,
    draftTone: "professional",
    isRead: false,
    isStarred: false,
    receivedAt: partial.createdAt,
    ...partial,
    snippet: partial.snippet ?? body.slice(0, 120),
  };
}

async function logAction(
  threadId: string | null,
  actionType: string,
  aiDecision: string,
  confidenceScore: number,
  humanOverride = false
) {
  const entry: AiActionLog = {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: DEFAULT_WORKSPACE_ID,
    threadId,
    actionType,
    aiDecision,
    confidenceScore,
    humanOverride,
    createdAt: nowIso(),
  };
  aiLogs.unshift(entry);
  if (aiLogs.length > 200) aiLogs.length = 200;
  await supabaseInsertAiLog(entry);
}

function seedMemory() {
  if (seeded) return;
  seeded = true;
  const samples: Array<Omit<EmailThread, "id" | "createdAt" | "updatedAt" | "engine" | "snoozeUntil" | "workspaceId" | "emailAccountId" | "toEmail" | "snippet" | "draftTone" | "isRead" | "isStarred" | "receivedAt" | "externalThreadId">> = [
    {
      fromName: "Maya Chen",
      fromEmail: "maya@northwindhvac.com",
      subject: "Need pricing for GHL scoring rollout this week",
      body: "Hey team, we're locking in budget for Q2 rollout and need the exact pricing for the GHL scoring system. Can you send over a one-pager by EOD?",
      category: "action_required",
      sentiment: "positive",
      urgencyScore: 92,
      aiConfidence: 94,
      routeTo: "Sales · Deveku",
      draftReply:
        "Maya — thanks. I can send the one-pager today and hold Thu 15:00–15:30 CT. Confirm and I'll calendar it.",
      status: "open",
      reasoning: "Buyer intent + timeline this week + budget stated",
      needsReview: true,
    },
    {
      fromName: "Priya Shah",
      fromEmail: "priya@techventures.com",
      subject: "Intro call — EA coverage for board week",
      body: "Need to coordinate 3 exec calendars prior to Friday's investor presentation. Can we schedule a 30-min intro call?",
      category: "meeting",
      sentiment: "neutral",
      urgencyScore: 88,
      aiConfidence: 91,
      routeTo: "Executive · Sarah",
      draftReply: "Hi Priya, I'll coordinate with the exec team. Are you available Thu 2pm or Fri 10am?",
      status: "review",
      reasoning: "Meeting request with multiple stakeholders",
      needsReview: true,
    },
    {
      fromName: "Luis Ortega",
      fromEmail: "luis@greenleaf.co",
      subject: "FYI: landscaping ad spend report attached",
      body: "Attached the monthly performance metrics for the regional Google Ads campaign. Nothing urgent, just for your records.",
      category: "fyi",
      sentiment: "positive",
      urgencyScore: 34,
      aiConfidence: 96,
      routeTo: "Archive",
      draftReply: "",
      status: "archived",
      reasoning: "Informational only, no action required",
      needsReview: false,
    },
    {
      fromName: "Crypto Blast",
      fromEmail: "noreply@cryptoblast.io",
      subject: "FREE NFT DROP CLICK NOW",
      body: "Claim your complimentary mint before whitelist closes in 15 minutes!!!",
      category: "spam",
      sentiment: "neutral",
      urgencyScore: 4,
      aiConfidence: 99,
      routeTo: "Spam",
      draftReply: "",
      status: "blocked",
      reasoning: "Obvious spam with urgency tactics",
      needsReview: false,
    },
  ];

  samples.forEach((sample, i) => {
    const id = `thr-${sample.fromEmail.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
    const createdAt = new Date(Date.now() - (i + 1) * 58 * 60_000).toISOString();
    const thread = makeThread({
      ...sample,
      id,
      createdAt,
      updatedAt: createdAt,
      snoozeUntil: null,
      engine: "heuristic",
      isRead: sample.status === "archived" || sample.status === "blocked",
    });
    threads.set(id, thread);
    messages.set(id, [
      {
        id: `tm-${id}-0`,
        threadId: id,
        messageId: `msg-${id}`,
        fromEmail: thread.fromEmail,
        toEmail: thread.toEmail,
        subject: thread.subject,
        body: thread.body,
        sentAt: createdAt,
        createdAt,
      },
    ]);
  });
}

async function hydrateFromRemote() {
  if (remoteBootstrapped || !isSupabaseConfigured()) return;
  seedMemory();
  const remote = await supabaseListThreads();
  if (remote === null) return;
  remoteBootstrapped = true;
  if (remote.length > 0) {
    threads.clear();
    for (const t of remote) threads.set(t.id, t);
  } else {
    await supabaseUpsertThreads([...threads.values()]);
    for (const list of messages.values()) await supabaseUpsertThreadMessages(list);
  }
  const remotePrefs = await supabaseGetPreferences(DEFAULT_WORKSPACE_ID);
  if (remotePrefs) {
    prefs = {
      ...prefs,
      ...remotePrefs,
      customRules: remotePrefs.customRules?.length ? remotePrefs.customRules : prefs.customRules,
      templates: remotePrefs.templates?.length ? remotePrefs.templates : prefs.templates,
    };
  }
  const logs = await supabaseListAiLogs();
  if (logs?.length) {
    aiLogs.length = 0;
    aiLogs.push(...logs);
  }
}

async function persist(thread: EmailThread) {
  threads.set(thread.id, thread);
  await supabaseUpsertThread(thread);
}

export async function listMessages(): Promise<InboxMessage[]> {
  seedMemory();
  await hydrateFromRemote();
  const remote = await supabaseListThreads();
  if (remote && remote.length > 0) {
    for (const t of remote) threads.set(t.id, t);
  }
  return [...threads.values()]
    .filter((t) => !t.snoozeUntil || Date.parse(t.snoozeUntil) <= Date.now())
    .map(toInboxMessage)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function listAllThreads(): Promise<EmailThread[]> {
  await listMessages();
  return [...threads.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function getMessage(id: string): Promise<InboxMessage | null> {
  seedMemory();
  await hydrateFromRemote();
  const t = threads.get(id);
  return t ? toInboxMessage(t) : null;
}

export async function getThread(id: string): Promise<EmailThread | null> {
  seedMemory();
  await hydrateFromRemote();
  return threads.get(id) ?? null;
}

export async function listThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  seedMemory();
  await hydrateFromRemote();
  const remote = await supabaseListThreadMessages(threadId);
  if (remote && remote.length > 0) {
    messages.set(threadId, remote);
    return remote;
  }
  return [...(messages.get(threadId) ?? [])].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export async function patchMessage(
  id: string,
  patch: Partial<
    Pick<
      EmailThread,
      | "status"
      | "needsReview"
      | "draftReply"
      | "routeTo"
      | "snoozeUntil"
      | "category"
      | "sentiment"
      | "isRead"
      | "isStarred"
      | "draftTone"
    >
  >,
  opts?: { humanOverride?: boolean; actionType?: string }
): Promise<InboxMessage | null> {
  const current = await getThread(id);
  if (!current) return null;
  const next: EmailThread = { ...current, ...patch, updatedAt: nowIso() };
  await persist(next);
  if (opts?.actionType) {
    await logAction(
      id,
      opts.actionType,
      JSON.stringify(patch),
      next.aiConfidence,
      opts.humanOverride ?? true
    );
  }
  return toInboxMessage(next);
}

export async function ingestMessage(input: {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}): Promise<InboxMessage> {
  seedMemory();
  await hydrateFromRemote();
  const scored = triageHeuristic(input);
  const createdAt = nowIso();
  const id = `thr-${Date.now().toString(36)}`;
  let thread = makeThread({
    ...scored,
    id,
    createdAt,
    updatedAt: createdAt,
    snoozeUntil: null,
    status: scored.category === "spam" ? "blocked" : scored.needsReview ? "review" : "open",
    engine: "heuristic",
    needsReview: scored.needsReview,
  });

  const history: ThreadMessage[] = [
    {
      id: `tm-${id}-0`,
      threadId: id,
      messageId: `msg-${id}`,
      fromEmail: input.fromEmail,
      toEmail: DEFAULT_TO_EMAIL,
      subject: input.subject,
      body: input.body,
      sentAt: createdAt,
      createdAt,
    },
  ];
  messages.set(id, history);

  if (prefs.autoTriage) {
    const smart = await smartReplyWithContext(thread, history);
    thread = {
      ...thread,
      draftReply: smart.draftReply || thread.draftReply,
      engine: smart.engine,
      aiConfidence: smart.confidence,
      reasoning: smart.reasoning ? `${thread.reasoning} · ${smart.reasoning}` : thread.reasoning,
      draftTone: prefs.defaultTone,
    };
  }

  const hay = `${input.subject}\n${input.body}`.toLowerCase();
  for (const rule of prefs.customRules.filter((r) => r.enabled && r.ifContains.trim())) {
    if (!hay.includes(rule.ifContains.toLowerCase())) continue;
    if (rule.then === "urgent") {
      thread = {
        ...thread,
        urgencyScore: Math.max(thread.urgencyScore, 90),
        sentiment: "urgent",
        needsReview: true,
        status: "review",
        reasoning: `${thread.reasoning} · Rule: urgent if contains “${rule.ifContains}”`,
      };
    } else if (rule.then === "vip_route") {
      thread = {
        ...thread,
        routeTo: "VIP · Deveku",
        needsReview: true,
        status: "review",
        urgencyScore: Math.max(thread.urgencyScore, 75),
        reasoning: `${thread.reasoning} · Rule: VIP route if contains “${rule.ifContains}”`,
      };
    } else if (rule.then === "block") {
      thread = {
        ...thread,
        status: "blocked",
        category: "spam",
        needsReview: false,
        routeTo: "Spam",
        reasoning: `${thread.reasoning} · Rule: block if contains “${rule.ifContains}”`,
      };
    } else if (rule.then === "review") {
      thread = {
        ...thread,
        needsReview: true,
        status: "review",
        reasoning: `${thread.reasoning} · Rule: force review if contains “${rule.ifContains}”`,
      };
    }
  }

  if (prefs.vipSenders.some((v) => v.toLowerCase() === input.fromEmail.toLowerCase())) {
    thread = {
      ...thread,
      urgencyScore: Math.max(thread.urgencyScore, 85),
      needsReview: true,
      status: thread.status === "blocked" ? "blocked" : "review",
      routeTo: "VIP · Deveku",
      reasoning: `${thread.reasoning} · VIP sender`,
    };
  }

  await persist(thread);
  await supabaseUpsertThreadMessages(history);
  await logAction(
    id,
    "triage",
    `${thread.category}/${thread.sentiment} score=${thread.urgencyScore}`,
    thread.aiConfidence,
    false
  );
  return toInboxMessage(thread);
}

export async function regenerateSmartReply(id: string): Promise<InboxMessage | null> {
  const thread = await getThread(id);
  if (!thread) return null;
  const history = await listThreadMessages(id);
  const smart = await smartReplyWithContext(thread, history);
  const next: EmailThread = {
    ...thread,
    draftReply: smart.draftReply,
    engine: smart.engine,
    aiConfidence: smart.confidence,
    updatedAt: nowIso(),
    draftTone: prefs.defaultTone,
    reasoning: smart.reasoning ?? thread.reasoning,
  };
  await persist(next);
  await logAction(id, "smart_reply", next.draftReply.slice(0, 180), next.aiConfidence, false);
  return toInboxMessage(next);
}

export async function snoozeThread(id: string, until?: string): Promise<InboxMessage | null> {
  const thread = await getThread(id);
  if (!thread) return null;
  const snoozeUntil = until || suggestSnoozeUntil(thread);
  const next: EmailThread = {
    ...thread,
    snoozeUntil,
    needsReview: false,
    updatedAt: nowIso(),
  };
  await persist(next);
  await logAction(id, "snooze", `until ${snoozeUntil}`, thread.aiConfidence, true);
  return toInboxMessage(next);
}

export async function wakeSnoozed(): Promise<number> {
  seedMemory();
  await hydrateFromRemote();
  const now = Date.now();
  let n = 0;
  for (const thread of threads.values()) {
    if (thread.snoozeUntil && Date.parse(thread.snoozeUntil) <= now) {
      await persist({
        ...thread,
        snoozeUntil: null,
        needsReview: thread.category !== "spam" && thread.category !== "fyi",
        status: thread.status === "archived" ? "open" : thread.status,
        updatedAt: nowIso(),
      });
      n += 1;
    }
  }
  return n;
}

export async function listAiLogs(): Promise<AiActionLog[]> {
  seedMemory();
  await hydrateFromRemote();
  const remote = await supabaseListAiLogs();
  if (remote?.length) return remote;
  return [...aiLogs];
}

export async function getPreferences(): Promise<UserPreferences> {
  seedMemory();
  await hydrateFromRemote();
  return prefs;
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  prefs = { ...prefs, ...patch };
  await supabaseUpsertPreferences(prefs);
  return prefs;
}

export function getDraftTone(): DraftTone {
  return prefs.defaultTone;
}
