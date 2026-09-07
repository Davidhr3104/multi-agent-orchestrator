import type { EmailThread, ThreadCategory, ThreadSentiment, ThreadMessage } from "@/lib/types";

export function detectSentiment(blob: string): ThreadSentiment {
  const text = blob.toLowerCase();
  if (/urgent|asap|immediately|critical|deadline today|escalate/.test(text)) return "urgent";
  if (/angry|unacceptable|frustrated|disappointed|lawsuit|complaint|furious/.test(text)) {
    return "negative";
  }
  if (/thank|great|appreciate|excited|pleased|wonderful|looking forward/.test(text)) {
    return "positive";
  }
  return "neutral";
}

export function categorizeThread(blob: string, fromEmail: string): ThreadCategory {
  if (/nft|crypto|followers|free money|click here/.test(blob) || fromEmail.endsWith(".invalid")) {
    return "spam";
  }
  if (/\bfyi\b|no action|for context|just sharing|heads up/.test(blob)) return "fyi";
  if (/call|meet|calendar|intro|zoom|teams invite|board week/.test(blob)) return "meeting";
  return "action_required";
}

export function urgencyScore(blob: string, category: ThreadCategory, sentiment: ThreadSentiment): number {
  if (category === "spam") return 4;
  let score = 48;
  if (/this week|asap|today|urgent|before friday|board week|eod|cob/.test(blob)) score += 28;
  if (/\$|budget|invoice|contract|proposal/.test(blob)) score += 12;
  if (category === "meeting") score += 8;
  if (category === "fyi") score -= 20;
  if (sentiment === "urgent") score += 15;
  if (sentiment === "negative") score += 10;
  if (sentiment === "positive") score -= 4;
  return Math.max(0, Math.min(100, score));
}

export function smartReplyHeuristic(input: {
  fromName: string;
  subject: string;
  body: string;
  category: ThreadCategory;
  sentiment: ThreadSentiment;
  prior?: ThreadMessage[];
}): string {
  if (input.category === "spam" || input.category === "fyi") return "";
  const first = input.fromName.split(/\s+/)[0] || "there";
  const contextHint =
    input.prior && input.prior.length > 1
      ? ` Re: the ongoing thread (${input.prior.length} messages).`
      : "";
  if (input.category === "meeting") {
    return `${first} — thanks for reaching out.${contextHint} I can hold two slots this week; reply with your timezone and I’ll confirm.`;
  }
  if (input.sentiment === "negative") {
    return `${first} — thank you for flagging this. I’m reviewing now and will reply with a concrete next step within one business day.`;
  }
  if (input.sentiment === "urgent") {
    return `${first} — received and prioritizing.${contextHint} I’ll confirm ownership and ETA shortly.`;
  }
  return `${first} — thanks.${contextHint} I’ll follow up with next steps on “${input.subject.slice(0, 48)}” today.`;
}

export type TriageResult = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  category: ThreadCategory;
  sentiment: ThreadSentiment;
  urgencyScore: number;
  aiConfidence: number;
  routeTo: string;
  draftReply: string;
  reasoning: string;
  needsReview: boolean;
};

export function triageHeuristic(input: {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  prior?: ThreadMessage[];
}): TriageResult {
  const blob = `${input.subject}\n${input.body}`.toLowerCase();
  const category = categorizeThread(blob, input.fromEmail);
  const sentiment = detectSentiment(blob);
  const score = urgencyScore(blob, category, sentiment);
  const draftReply = smartReplyHeuristic({
    fromName: input.fromName,
    subject: input.subject,
    body: input.body,
    category,
    sentiment,
    prior: input.prior,
  });
  const routeTo =
    category === "spam"
      ? "Spam"
      : category === "fyi"
        ? "Archive"
        : category === "meeting"
          ? "EA Desk"
          : "Sales · Deveku";
  const needsReview = category !== "spam" && category !== "fyi";
  const reasoning = [
    `Category: ${category.replace(/_/g, " ")}`,
    `Sentiment: ${sentiment}`,
    score >= 80 ? "Elevated urgency." : category === "fyi" ? "Informational." : "Draft ready for HITL.",
  ].join(" · ");

  return {
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
    category,
    sentiment,
    urgencyScore: score,
    aiConfidence: 62,
    routeTo,
    draftReply,
    reasoning,
    needsReview,
  };
}

export function suggestSnoozeUntil(thread: Pick<EmailThread, "urgencyScore" | "sentiment" | "category">): string {
  const now = Date.now();
  if (thread.category === "fyi") return new Date(now + 3 * 86_400_000).toISOString();
  if (thread.sentiment === "urgent" || thread.urgencyScore >= 85) {
    return new Date(now + 2 * 3_600_000).toISOString();
  }
  if (thread.urgencyScore >= 60) return new Date(now + 24 * 3_600_000).toISOString();
  return new Date(now + 2 * 86_400_000).toISOString();
}
