import type { AudienceComment, Post } from "./types";

const LEAD = /\b(price|how much|book|buy|order|install|quote|dm me|interested|when can|available)\b/i;
const COMPLAINT = /\b(scam|refund|angry|worst|never again|complaint|lawsuit)\b/i;
const SPAM = /\b(crypto|giveaway|forex|nft drop|click here)\b/i;

export function classifyAudienceComment(text: string): AudienceComment["kind"] {
  if (SPAM.test(text)) return "spam";
  if (COMPLAINT.test(text)) return "complaint";
  if (LEAD.test(text)) return "lead";
  return "unsure";
}

export type LeadCite = {
  postId: string;
  caption: string;
  channel: Post["channel"];
  leads: number;
  comments: AudienceComment[];
};

/** Count interested comments per post. Invented demo comments are included and must stay labeled in the UI. */
export function leadsByPost(posts: Post[], comments: AudienceComment[], fromIso: string, toIso: string): LeadCite[] {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  const inWindow = comments.filter((c) => {
    const t = Date.parse(c.at);
    return t >= from && t <= to && c.kind === "lead";
  });
  const map = new Map<string, AudienceComment[]>();
  for (const c of inWindow) {
    const list = map.get(c.postId) ?? [];
    list.push(c);
    map.set(c.postId, list);
  }
  return [...map.entries()]
    .map(([postId, rows]) => {
      const post = posts.find((p) => p.id === postId);
      return {
        postId,
        caption: post?.caption ?? "(post missing)",
        channel: post?.channel ?? "instagram",
        leads: rows.length,
        comments: rows,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export function monthWindow(now = new Date()): { from: string; to: string } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const to = now.toISOString();
  return { from, to };
}
