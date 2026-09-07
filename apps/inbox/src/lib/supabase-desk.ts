import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AiActionLog,
  DraftTone,
  EmailThread,
  ThreadCategory,
  ThreadMessage,
  ThreadSentiment,
  ThreadStatus,
  UserPreferences,
} from "@/lib/types";

type Client = SupabaseClient;
let cached: Client | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabase(): Client | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

type DeskQuery = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean }
    ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    eq: (
      col: string,
      value: string
    ) => {
      maybeSingle: () => Promise<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
      order: (
        col: string,
        opts: { ascending: boolean }
      ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      limit: (n: number) => Promise<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    };
    limit: (n: number) => Promise<{
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    }>;
  };
  upsert: (
    row: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string }
  ) => Promise<{ error: { message: string } | null }>;
  insert: (
    row: Record<string, unknown> | Record<string, unknown>[]
  ) => Promise<{ error: { message: string } | null }>;
};

function inboxTable(
  db: Client,
  table: "email_threads" | "thread_messages" | "ai_actions_log" | "user_preferences" | "workspaces"
): DeskQuery {
  return (
    db as unknown as { schema: (name: string) => { from: (t: string) => DeskQuery } }
  )
    .schema("inbox")
    .from(table);
}

function asCategory(v: unknown): ThreadCategory {
  if (v === "fyi" || v === "meeting" || v === "spam" || v === "action_required") return v;
  return "action_required";
}
function asSentiment(v: unknown): ThreadSentiment {
  if (v === "positive" || v === "negative" || v === "urgent" || v === "neutral") return v;
  return "neutral";
}
function asStatus(v: unknown): ThreadStatus {
  if (v === "open" || v === "review" || v === "routed" || v === "blocked" || v === "archived") return v;
  return "open";
}
function asTone(v: unknown): DraftTone {
  if (v === "friendly" || v === "concise" || v === "formal" || v === "professional") return v;
  return "professional";
}

export function toThreadRow(thread: EmailThread) {
  return {
    id: thread.id,
    workspace_id: thread.workspaceId,
    email_account_id: thread.emailAccountId,
    external_thread_id: thread.externalThreadId,
    subject: thread.subject,
    from_name: thread.fromName,
    from_email: thread.fromEmail,
    to_email: thread.toEmail,
    body: thread.body,
    snippet: thread.snippet,
    category: thread.category,
    sentiment: thread.sentiment,
    urgency_score: thread.urgencyScore,
    ai_confidence: thread.aiConfidence,
    classification_reasoning: thread.reasoning,
    route_to: thread.routeTo,
    draft_reply: thread.draftReply,
    draft_tone: thread.draftTone,
    status: thread.status,
    is_read: thread.isRead,
    is_starred: thread.isStarred,
    needs_review: thread.needsReview,
    snooze_until: thread.snoozeUntil,
    engine: thread.engine,
    received_at: thread.receivedAt,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
  };
}

export function fromThreadRow(row: Record<string, unknown>): EmailThread {
  const body = String(row.body ?? "");
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id ?? "ws-northwind"),
    emailAccountId: row.email_account_id != null ? String(row.email_account_id) : null,
    externalThreadId: row.external_thread_id != null ? String(row.external_thread_id) : null,
    subject: String(row.subject ?? ""),
    fromName: String(row.from_name ?? ""),
    fromEmail: String(row.from_email ?? ""),
    toEmail: String(row.to_email ?? "triage@company.io"),
    body,
    snippet: String(row.snippet ?? body.slice(0, 120)),
    category: asCategory(row.category),
    sentiment: asSentiment(row.sentiment),
    urgencyScore: Number(row.urgency_score ?? 0),
    aiConfidence: Number(row.ai_confidence ?? 0),
    routeTo: String(row.route_to ?? ""),
    draftReply: String(row.draft_reply ?? ""),
    draftTone: asTone(row.draft_tone),
    status: asStatus(row.status),
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    snoozeUntil: row.snooze_until != null ? String(row.snooze_until) : null,
    reasoning: String(row.classification_reasoning ?? row.reasoning ?? ""),
    needsReview: Boolean(row.needs_review),
    engine: row.engine === "claude" ? "claude" : "heuristic",
    receivedAt: String(row.received_at ?? row.created_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

function toMessageRow(msg: ThreadMessage) {
  return {
    id: msg.id,
    thread_id: msg.threadId,
    message_id: msg.messageId ?? null,
    from_email: msg.fromEmail,
    to_email: msg.toEmail ?? null,
    subject: msg.subject ?? null,
    body: msg.body,
    sent_at: msg.sentAt,
    created_at: msg.createdAt,
  };
}

function fromMessageRow(row: Record<string, unknown>): ThreadMessage {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    messageId: row.message_id != null ? String(row.message_id) : undefined,
    fromEmail: String(row.from_email ?? ""),
    toEmail: row.to_email != null ? String(row.to_email) : undefined,
    subject: row.subject != null ? String(row.subject) : undefined,
    body: String(row.body ?? ""),
    sentAt: String(row.sent_at ?? row.created_at),
    createdAt: String(row.created_at),
  };
}

export async function supabaseListThreads(): Promise<EmailThread[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await inboxTable(db, "email_threads").select("*").order("received_at", {
    ascending: false,
  });
  if (error) {
    console.warn("[helix-inbox] list threads skipped:", error.message);
    return null;
  }
  return (data ?? []).map((row) => fromThreadRow(row as Record<string, unknown>));
}

export async function supabaseUpsertThread(thread: EmailThread): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await inboxTable(db, "email_threads").upsert(toThreadRow(thread));
  if (error) {
    console.warn("[helix-inbox] upsert thread skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseUpsertThreads(threads: EmailThread[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || threads.length === 0) return false;
  const { error } = await inboxTable(db, "email_threads").upsert(threads.map(toThreadRow));
  if (error) {
    console.warn("[helix-inbox] bootstrap threads skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseListThreadMessages(threadId: string): Promise<ThreadMessage[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await inboxTable(db, "thread_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true });
  if (error) {
    console.warn("[helix-inbox] list messages skipped:", error.message);
    return null;
  }
  return (data ?? []).map((row) => fromMessageRow(row as Record<string, unknown>));
}

export async function supabaseUpsertThreadMessages(messages: ThreadMessage[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || messages.length === 0) return false;
  const { error } = await inboxTable(db, "thread_messages").upsert(messages.map(toMessageRow));
  if (error) {
    console.warn("[helix-inbox] upsert messages skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseInsertAiLog(log: Omit<AiActionLog, "id" | "createdAt"> & { id?: string }): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const row = {
    id: log.id ?? `log-${Date.now().toString(36)}`,
    workspace_id: log.workspaceId,
    thread_id: log.threadId,
    action_type: log.actionType,
    ai_decision: log.aiDecision,
    confidence_score: log.confidenceScore,
    human_override: log.humanOverride,
    created_at: new Date().toISOString(),
  };
  const { error } = await inboxTable(db, "ai_actions_log").insert(row);
  if (error) {
    console.warn("[helix-inbox] ai log skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseListAiLogs(limit = 40): Promise<AiActionLog[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await inboxTable(db, "ai_actions_log").select("*").order("created_at", {
    ascending: false,
  });
  if (error) {
    console.warn("[helix-inbox] list ai log skipped:", error.message);
    return null;
  }
  return (data ?? []).slice(0, limit).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      workspaceId: r.workspace_id != null ? String(r.workspace_id) : null,
      threadId: r.thread_id != null ? String(r.thread_id) : null,
      actionType: String(r.action_type ?? ""),
      aiDecision: String(r.ai_decision ?? ""),
      confidenceScore: Number(r.confidence_score ?? 0),
      humanOverride: Boolean(r.human_override),
      createdAt: String(r.created_at),
    };
  });
}

export async function supabaseGetPreferences(workspaceId: string): Promise<UserPreferences | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await inboxTable(db, "user_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .limit(1);
  if (error || !data?.length) return null;
  const r = data[0] as Record<string, unknown>;
  const rawRules = r.custom_rules;
  let customRules: UserPreferences["customRules"] = [];
  let templates: UserPreferences["templates"] = [];
  if (Array.isArray(rawRules)) {
    customRules = rawRules as UserPreferences["customRules"];
  } else if (rawRules && typeof rawRules === "object") {
    const bag = rawRules as { rules?: unknown; templates?: unknown };
    if (Array.isArray(bag.rules)) customRules = bag.rules as UserPreferences["customRules"];
    if (Array.isArray(bag.templates)) templates = bag.templates as UserPreferences["templates"];
  }

  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    autoTriage: Boolean(r.auto_triage ?? true),
    defaultTone: asTone(r.default_tone),
    vipSenders: Array.isArray(r.vip_senders) ? (r.vip_senders as string[]) : [],
    theme: r.theme === "light" ? "light" : "dark",
    customRules,
    templates,
  };
}

export async function supabaseUpsertPreferences(prefs: UserPreferences): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await inboxTable(db, "user_preferences").upsert(
    {
      id: prefs.id,
      workspace_id: prefs.workspaceId,
      auto_triage: prefs.autoTriage,
      default_tone: prefs.defaultTone,
      vip_senders: prefs.vipSenders,
      theme: prefs.theme,
      custom_rules: { rules: prefs.customRules, templates: prefs.templates },
    },
    { onConflict: "id" }
  );
  return !error;
}
