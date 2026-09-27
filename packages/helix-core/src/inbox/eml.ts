import { simpleParser } from "mailparser";

export type ParsedEml = {
  subject: string;
  fromEmail: string;
  /** The .eml's display name for the sender (e.g. "Jane Doe" from "Jane Doe <jane@example.com>"), when present. */
  fromName?: string;
  toEmail?: string;
  date: string;
  rfcMessageId?: string;
  inReplyTo?: string;
  references: string[];
  textBody: string;
};

/** Minimal shape this module needs from a thread — avoids importing an app-local EmailThread type
 * into the shared package. Callers (apps/inbox) pass their real EmailThread objects; only these
 * fields are read. */
export type MatchableThread = {
  id: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
};

export type MatchableMessage = {
  threadId: string;
  rfcMessageId?: string;
};

export async function parseEml(raw: Buffer | string): Promise<ParsedEml> {
  const parsed = await simpleParser(raw);
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];
  return {
    subject: parsed.subject ?? "",
    fromEmail: parsed.from?.value[0]?.address ?? "",
    fromName: parsed.from?.value[0]?.name || undefined,
    toEmail: parsed.to && "value" in parsed.to ? parsed.to.value[0]?.address : undefined,
    date: (parsed.date ?? new Date()).toISOString(),
    rfcMessageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references,
    textBody: parsed.text ?? "",
  };
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(re|fwd|fw):\s*/i, "").trim().toLowerCase();
}

/**
 * Two-tier match: by RFC Message-Id (in the parsed .eml's own id, In-Reply-To, or References)
 * against any known message's rfcMessageId, then by normalized subject + participant overlap.
 * Returns null when neither tier finds a match — caller creates a new thread in that case.
 */
export function matchThread(
  parsed: ParsedEml,
  threads: MatchableThread[],
  messages: MatchableMessage[]
): MatchableThread | null {
  const candidateIds = [parsed.rfcMessageId, parsed.inReplyTo, ...parsed.references].filter(
    (id): id is string => Boolean(id)
  );
  if (candidateIds.length > 0) {
    const byId = messages.find((m) => m.rfcMessageId && candidateIds.includes(m.rfcMessageId));
    if (byId) {
      const thread = threads.find((t) => t.id === byId.threadId);
      if (thread) return thread;
    }
  }
  const subject = normalizeSubject(parsed.subject);
  const bySubject = threads.find((t) => {
    if (normalizeSubject(t.subject) !== subject) return false;
    return (
      t.fromEmail.toLowerCase() === parsed.fromEmail.toLowerCase() ||
      t.toEmail.toLowerCase() === parsed.fromEmail.toLowerCase() ||
      (parsed.toEmail && t.fromEmail.toLowerCase() === parsed.toEmail.toLowerCase())
    );
  });
  return bySubject ?? null;
}
