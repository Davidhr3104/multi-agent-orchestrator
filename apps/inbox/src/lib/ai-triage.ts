import { isClaudeConfigured, parseJsonObject } from "@helix/core";
import { claudeMessages } from "@/lib/ai-usage";
import { getAgentProfile } from "@/lib/agent-profile";
import type { DraftTone, ThreadCategory, ThreadMessage, ThreadSentiment } from "@/lib/types";

/**
 * Claude triage for one inbound email: priority with reasons that quote the email, plus a draft in
 * the operator's own voice (learned from a few of their recent sent emails). Every quote is checked
 * against the email text; a quote Claude cannot back up is dropped rather than shown.
 */

const CATEGORIES: ThreadCategory[] = ["action_required", "fyi", "meeting", "spam"];
const SENTIMENTS: ThreadSentiment[] = ["positive", "neutral", "negative", "urgent"];

export type TriageReason = { reason: string; quote?: string };

export type ClaudeTriage = {
  category: ThreadCategory;
  sentiment: ThreadSentiment;
  urgencyScore: number;
  leadIntent: boolean;
  reasons: TriageReason[];
  draftReply: string;
  confidence: number;
};

export type TriageEmail = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  prior?: ThreadMessage[];
};

type RawTriage = {
  category?: string;
  sentiment?: string;
  urgencyScore?: number;
  leadIntent?: boolean;
  reasons?: Array<{ reason?: string; quote?: string }>;
  draftReply?: string;
  confidence?: number;
};

function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when `quote` appears in the email (whitespace- and case-insensitive). */
export function quoteIsInEmail(quote: string, email: Pick<TriageEmail, "subject" | "body">): boolean {
  const q = squash(quote.replace(/^["“”']+|["“”']+$/g, ""));
  if (q.length < 3) return false;
  return squash(`${email.subject}\n${email.body}`).includes(q);
}

export function buildTriagePrompt(email: TriageEmail, opts: { tone: DraftTone; voice?: string; toneSamples?: string[] }): string {
  const samples = (opts.toneSamples ?? []).slice(0, 3).map((s, i) => `--- Sample ${i + 1} ---\n${s.slice(0, 600)}`).join("\n");
  const prior = (email.prior ?? [])
    .slice(-4)
    .map((m) => `- ${m.fromEmail} @ ${m.sentAt}: ${m.body.slice(0, 300)}`)
    .join("\n");
  return `You triage email for an executive assistant. Return ONLY JSON with this shape:
{"category":"action_required|fyi|meeting|spam","sentiment":"positive|neutral|negative|urgent","urgencyScore":0-100,"leadIntent":true|false,"reasons":[{"reason":"why this priority, one short sentence","quote":"exact words copied from the email"}],"draftReply":"...","confidence":0-100}

Rules:
- Give 1-3 reasons. Each "quote" must be copied character-for-character from the subject or body below. Never paraphrase inside "quote".
- urgencyScore: 80+ only for a real deadline, an executive/VIP ask, money at risk or an angry customer.
- draftReply: empty string for spam and fyi. Otherwise max 90 words, in the operator's own voice${samples ? " (match the samples' greeting, sign-off, length and formality)" : ""}; preferred tone: ${opts.tone}.
- Never invent prices, dates, meeting times or commitments that are not in the email. If something must be confirmed, say you will confirm it.
- The draft is reviewed by a person before anything is sent.
${opts.voice ? `Company voice:\n${opts.voice.slice(0, 1500)}\n` : ""}${samples ? `Operator's recent sent emails (style reference only, do not reuse their facts):\n${samples}\n` : ""}
Email:
From: ${email.fromName} <${email.fromEmail}>
Subject: ${email.subject}
Body:
${email.body.slice(0, 4000)}
${prior ? `Earlier messages in the thread:\n${prior}` : ""}`;
}

export function parseClaudeTriage(text: string, email: TriageEmail): ClaudeTriage | null {
  const raw = parseJsonObject<RawTriage>(text);
  if (!raw) return null;
  const category = CATEGORIES.includes(raw.category as ThreadCategory) ? (raw.category as ThreadCategory) : null;
  const sentiment = SENTIMENTS.includes(raw.sentiment as ThreadSentiment) ? (raw.sentiment as ThreadSentiment) : "neutral";
  if (!category) return null;
  const urgency = Number(raw.urgencyScore);
  const reasons: TriageReason[] = (raw.reasons ?? [])
    .filter((r) => typeof r?.reason === "string" && r.reason.trim())
    .slice(0, 3)
    .map((r) => {
      const quote = typeof r.quote === "string" && quoteIsInEmail(r.quote, email) ? r.quote.trim().replace(/^["“”']+|["“”']+$/g, "") : undefined;
      return { reason: r.reason!.trim(), quote };
    });
  const draft = category === "spam" || category === "fyi" ? "" : (raw.draftReply ?? "").trim();
  return {
    category,
    sentiment,
    urgencyScore: Number.isFinite(urgency) ? Math.max(0, Math.min(100, Math.round(urgency))) : 50,
    leadIntent: category !== "spam" && category !== "fyi" && raw.leadIntent === true,
    reasons,
    draftReply: draft,
    confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(100, Math.round(Number(raw.confidence)))) : 75,
  };
}

export function formatTriageReasoning(t: ClaudeTriage): string {
  const parts = t.reasons.map((r) => (r.quote ? `${r.reason} (“${r.quote}”)` : `${r.reason} (no exact quote)`));
  return ["Claude triage", ...parts].join(" · ");
}

/** Returns null (and the caller keeps the labelled heuristic) when there is no key or Claude fails. */
export async function triageWithClaude(
  email: TriageEmail,
  opts: { tone: DraftTone; toneSamples?: string[] }
): Promise<ClaudeTriage | null> {
  if (!isClaudeConfigured()) return null;
  const profile = getAgentProfile();
  try {
    const { text } = await claudeMessages({
      purpose: "triage",
      model: profile.model,
      maxTokens: 700,
      timeoutMs: 25_000,
      messages: [{ role: "user", content: buildTriagePrompt(email, { tone: opts.tone, voice: profile.prompt, toneSamples: opts.toneSamples }) }],
    });
    return parseClaudeTriage(text, email);
  } catch (err) {
    console.warn("[helix-inbox] Claude triage fallback:", err instanceof Error ? err.message : err);
    return null;
  }
}
