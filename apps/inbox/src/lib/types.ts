export type ThreadCategory = "action_required" | "fyi" | "meeting" | "spam";
export type ThreadSentiment = "positive" | "neutral" | "negative" | "urgent";
export type ThreadStatus = "open" | "review" | "routed" | "sent" | "blocked" | "archived";
export type DraftTone = "professional" | "friendly" | "concise" | "formal";
export type DeskTheme = "dark" | "light";

export type ThreadMessage = {
  id: string;
  threadId: string;
  messageId?: string;
  /** Gmail's own message id (msg.id from the Gmail API) — needed to fetch/reply to this exact message. */
  gmailMessageId?: string;
  /** The RFC 822 Message-Id header (e.g. "<abc@mail.gmail.com>") — needed to build In-Reply-To/References on a threaded reply. */
  rfcMessageId?: string;
  fromEmail: string;
  toEmail?: string;
  subject?: string;
  body: string;
  sentAt: string;
  createdAt: string;
};

export type EmailAccount = {
  id: string;
  workspaceId: string | null;
  emailAddress: string;
  provider: string | null;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  gmailHistoryId?: string;
  isConnected: boolean;
  lastSyncedAt?: string;
};

export type AiActionLog = {
  id: string;
  workspaceId: string | null;
  threadId: string | null;
  actionType: string;
  aiDecision: string;
  confidenceScore: number;
  humanOverride: boolean;
  createdAt: string;
};

export type UserPreferences = {
  id: string;
  workspaceId: string;
  autoTriage: boolean;
  defaultTone: DraftTone;
  vipSenders: string[];
  theme: DeskTheme;
  customRules: CustomRule[];
  templates: EmailTemplate[];
};

export type CustomRule = {
  id: string;
  ifContains: string;
  then: "urgent" | "vip_route" | "block" | "review";
  enabled: boolean;
};

export type EmailTemplate = {
  id: string;
  name: string;
  body: string;
};

export type EmailThread = {
  id: string;
  workspaceId: string;
  emailAccountId: string | null;
  externalThreadId: string | null;
  subject: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  body: string;
  snippet: string;
  category: ThreadCategory;
  sentiment: ThreadSentiment;
  urgencyScore: number;
  aiConfidence: number;
  routeTo: string;
  draftReply: string;
  draftTone: DraftTone;
  status: ThreadStatus;
  isRead: boolean;
  isStarred: boolean;
  snoozeUntil: string | null;
  reasoning: string;
  needsReview: boolean;
  engine: "claude" | "heuristic";
  leadIntent: boolean;
  handedOffAt?: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: ThreadMessage[];
};

export type InboxMessage = EmailThread & {
  priority: "urgent" | "normal" | "low";
  kind: "action" | "fyi" | "meeting" | "spam";
  score: number;
};

export function toInboxMessage(thread: EmailThread): InboxMessage {
  const kind =
    thread.category === "action_required"
      ? "action"
      : thread.category === "fyi"
        ? "fyi"
        : thread.category === "meeting"
          ? "meeting"
          : "spam";
  const priority =
    thread.urgencyScore >= 80 || thread.sentiment === "urgent"
      ? "urgent"
      : thread.urgencyScore >= 45
        ? "normal"
        : "low";
  return { ...thread, kind, priority, score: thread.urgencyScore };
}

export function categoryLabel(category: ThreadCategory): string {
  switch (category) {
    case "action_required":
      return "Action required";
    case "fyi":
      return "FYI";
    case "meeting":
      return "Meeting";
    case "spam":
      return "Spam";
  }
}

export const DEFAULT_WORKSPACE_ID = "ws-northwind";
export const DEFAULT_ACCOUNT_ID = "acc-triage";
export const DEFAULT_TO_EMAIL = "triage@company.io";
