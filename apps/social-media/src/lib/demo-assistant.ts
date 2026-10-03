import type { ActionProposal } from "@helix/core";
import { channelLabel, formatSlot, postLabel, STATUS_LABEL } from "./format";
import type { ScoredPost } from "./store";
import type { Brand, Channel } from "./types";

/**
 * Deterministic stand-in for Claude, used only on the demo desk when no ANTHROPIC_API_KEY is set. Every post,
 * score and date in a reply comes from the desk data passed in, and posts are linked as [label](/posts/<id>).
 * Requests to change something come back as a command proposal; the risk policy decides whether it runs or asks.
 */

export type DemoReply = { answer: string; command?: boolean; proposal?: ActionProposal };

const DAY = 86_400_000;
const lk = (p: ScoredPost) => `[${postLabel(p)}](/posts/${p.id})`;
const target = (p: ScoredPost) => ({ id: p.id, label: postLabel(p) });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

const CHANNEL_WORDS: [RegExp, Channel][] = [
  [/\b(instagram|insta|ig)\b/, "instagram"],
  [/\blinkedin\b/, "linkedin"],
  [/\b(twitter|x post|on x|tweet)\b/, "x"],
  [/\btiktok\b/, "tiktok"],
  [/\b(facebook|fb)\b/, "facebook"],
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const STOP = new Set(["the", "and", "for", "post", "posts", "approve", "this", "that", "send", "back", "move", "reschedule", "note", "add", "with", "about", "explain", "why", "tell", "show", "what", "review", "submit", "changes", "request", "because", "tomorrow", "today", "next", "week"]);
const tokens = (t: string) => (t.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "today" / "tomorrow" / weekday name, if the text names a day. Returns the day's midnight. */
function dayIn(q: string, now: number): number | null {
  const today = startOfDay(now);
  if (/\btoday\b/.test(q)) return today;
  if (/\btomorrow\b/.test(q)) return today + DAY;
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(q));
  if (wd >= 0) {
    const diff = (wd - new Date(today).getDay() + 7) % 7 || 7;
    return today + diff * DAY;
  }
  return null;
}

function findPost(q: string, posts: ScoredPost[], now: number): ScoredPost | undefined {
  const tag = q.match(/#([a-z0-9_]+)/)?.[1];
  const channel = CHANNEL_WORDS.find(([re]) => re.test(q))?.[1];
  const day = dayIn(q, now);
  let pool = posts;
  if (tag) pool = pool.filter((p) => p.hashtags.includes(tag));
  if (channel) pool = pool.filter((p) => p.channel === channel);
  if (day !== null) pool = pool.filter((p) => startOfDay(Date.parse(p.scheduledFor)) === day);
  if ((tag || channel || day !== null) && pool.length >= 1) {
    if (pool.length === 1) return pool[0];
    const words = new Set(tokens(q));
    return [...pool].sort((a, b) => overlap(b, words) - overlap(a, words))[0];
  }
  const words = new Set(tokens(q));
  const ranked = posts.map((p) => ({ p, s: overlap(p, words) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s);
  return ranked[0]?.p;
}

function overlap(p: ScoredPost, words: Set<string>) {
  return [...new Set(tokens(`${p.caption} ${p.hashtags.join(" ")}`))].filter((t) => words.has(t)).length;
}

function summary(posts: ScoredPost[], brand: Brand, now: number): string {
  const by = (s: ScoredPost["status"]) => posts.filter((p) => p.status === s);
  const week = posts.filter((p) => Date.parse(p.scheduledFor) - now < 7 * DAY);
  const queue = by("needs_review");
  const readyQueue = queue.filter((p) => p.readiness.ready);
  return [
    `${brand.name} has ${plural(posts.length, "post")} on the calendar: ${by("approved").length} approved, ${queue.length} waiting for review, ${by("changes").length} sent back, ${by("draft").length} drafts.`,
    `${plural(week.length, "post")} fall in the next 7 days.`,
    queue.length ? `In the review queue, ${readyQueue.length} of ${queue.length} pass every readiness check.` : "The review queue is empty.",
    by("published").length
      ? `${plural(by("published").length, "post")} went out after a person approved and published each one.`
      : "Nothing has been published from this desk. Publishing needs a person to approve and press Publish on each post.",
  ].join(" ");
}

function queueList(posts: ScoredPost[]): string {
  const q = posts.filter((p) => p.status === "needs_review");
  if (q.length === 0) return "Nothing is waiting for review.";
  return `${plural(q.length, "post")} waiting for a person, soonest first:\n${q
    .map((p) => `• ${lk(p)} — readiness ${p.readiness.score}/100${p.readiness.ready ? "" : `: ${p.readiness.summary}`}`)
    .join("\n")}\nSay "approve the ready ones" and I'll ask you to confirm before anything changes.`;
}

function problems(posts: ScoredPost[]): string {
  const bad = posts.filter((p) => p.status !== "approved" && p.status !== "published" && !p.readiness.ready);
  if (bad.length === 0) return "Every open post passes the readiness checks.";
  return `${plural(bad.length, "post")} need work before anyone approves them:\n${bad.map((p) => `• ${lk(p)} — ${p.readiness.score}/100. ${p.readiness.summary}`).join("\n")}`;
}

function nextWeek(posts: ScoredPost[], now: number): string {
  const wk = posts.filter((p) => Date.parse(p.scheduledFor) - now < 7 * DAY);
  if (wk.length === 0) return "Nothing is scheduled in the next 7 days.";
  return `Next 7 days:\n${wk.map((p) => `• ${formatSlot(p.scheduledFor)} — ${lk(p)} (${STATUS_LABEL[p.status].toLowerCase()})`).join("\n")}`;
}

function explain(p: ScoredPost): string {
  return `${lk(p)} — ${STATUS_LABEL[p.status]}, readiness ${p.readiness.score}/100.\n${p.readiness.factors
    .map((f) => `• ${f.label}: ${f.points}/${f.max} — ${f.detail}`)
    .join("\n")}\n${p.readiness.summary}${p.approvedBy ? `\nApproved by ${p.approvedBy}.` : ""}`;
}

function newSlot(q: string, from: ScoredPost, now: number): string | null {
  const keep = new Date(from.scheduledFor);
  const set = (dayMs: number) => {
    const d = new Date(dayMs);
    d.setHours(keep.getHours(), keep.getMinutes(), 0, 0);
    return d.toISOString();
  };
  const plus = q.match(/\+?\s*(\d{1,2})\s*days?\s*(later)?/);
  const toPart = q.split(/\bto\b/).slice(1).join(" to ");
  const day = dayIn(toPart || q, now);
  if (day !== null) return set(day);
  if (plus) return set(startOfDay(keep.getTime()) + Number(plus[1]) * DAY);
  return null;
}

const proposal = (action: string, summary: string, targets: ScoredPost[], params?: Record<string, unknown>): ActionProposal => ({
  action,
  summary,
  targets: targets.map(target),
  ...(params ? { params } : {}),
});

const HELP =
  'I can summarize the calendar, list what\'s waiting for review, flag posts that aren\'t ready, and explain any post\'s readiness score. I can also send a post back, move it, add a note or queue it for approval — and I\'ll ask you before approving anything. Try: "What needs review?" or "Explain the Instagram post today".';

export function buildDemoReply(question: string, posts: ScoredPost[], brand: Brand, now: number): DemoReply {
  const q = question.trim().toLowerCase();
  if (posts.length === 0) return { answer: "There are no posts on this desk yet." };
  const post = findPost(q, posts, now);

  if (/\bapprove\b/.test(q)) {
    if (/\b(ready ones|all ready|ready posts|everything ready|all the ready)\b/.test(q)) {
      const t = posts.filter((p) => p.status === "needs_review" && p.readiness.ready);
      if (t.length === 0) return { answer: "No post in the review queue passes every readiness check yet." };
      return { answer: `${plural(t.length, "post")} in the queue pass every check.`, command: true, proposal: proposal("approve_post", `Approve ${plural(t.length, "ready post")}`, t) };
    }
    if (!post) return { answer: 'Which post? Name the channel and day (e.g. "approve the Instagram post today") or open it and use Approve.' };
    if (post.status === "approved") return { answer: `${lk(post)} is already approved.` };
    if (!post.readiness.ready) return { answer: `I wouldn't approve ${lk(post)} yet — ${post.readiness.summary} You can still review it yourself from the post page.` };
    return { answer: `${lk(post)} passes every readiness check.`, command: true, proposal: proposal("approve_post", `Approve ${postLabel(post)}`, [post]) };
  }

  if (/send (it )?back|request changes|needs changes|reject/.test(q)) {
    if (!post) return { answer: "Which post should go back? Name the channel and day." };
    const note = question.split(/because|:|—/i).slice(1).join(" ").trim() || post.readiness.summary;
    return { answer: `Sending ${lk(post)} back with: "${note}".`, command: true, proposal: proposal("request_changes", `Send back ${postLabel(post)}`, [post], { note }) };
  }

  if (/\b(submit|send (it )?to review|queue it|queue (the|all|every))\b/.test(q)) {
    if (/\b(all|every) (ready )?drafts?\b/.test(q)) {
      const t = posts.filter((p) => (p.status === "draft" || p.status === "changes") && p.readiness.ready);
      if (t.length === 0) return { answer: "No draft passes every readiness check yet, so none are ready for review." };
      return { answer: `${plural(t.length, "draft")} pass every check.`, command: true, proposal: proposal("submit_for_review", `Send ${plural(t.length, "draft")} to review`, t) };
    }
    if (!post) return { answer: "Which draft should go to review? Name the channel and day." };
    if (post.status !== "draft" && post.status !== "changes") return { answer: `${lk(post)} is ${STATUS_LABEL[post.status].toLowerCase()}, not a draft.` };
    return { answer: `Queuing ${lk(post)} for review.`, command: true, proposal: proposal("submit_for_review", `Send ${postLabel(post)} to review`, [post]) };
  }

  if (/\b(move|reschedule|push|postpone)\b/.test(q)) {
    if (!post) return { answer: 'Which post should move? e.g. "move the TikTok post tomorrow to friday".' };
    const when = newSlot(q, post, now);
    if (!when) return { answer: `When should ${lk(post)} go out instead? Say a day ("to friday") or "+2 days".` };
    return {
      answer: `Moving ${lk(post)} from ${formatSlot(post.scheduledFor)} to ${formatSlot(when)}.`,
      command: true,
      proposal: proposal("reschedule_post", `Move ${postLabel(post)} to ${formatSlot(when)}`, [post], { when }),
    };
  }

  if (/\b(add (a )?note|note on|note to|comment on)\b/.test(q)) {
    if (!post) return { answer: "Which post is the note for? Name the channel and day." };
    const note = question.split(/:|—/).slice(1).join(" ").trim();
    if (!note) return { answer: `What should the note on ${lk(post)} say? Put it after a colon.` };
    return { answer: `Adding a note to ${lk(post)}.`, command: true, proposal: proposal("add_note", `Note on ${postLabel(post)}`, [post], { note }) };
  }

  if (post && /why|explain|score|ready|what about|tell me|check/.test(q)) return { answer: explain(post) };
  if (/need(s)? review|waiting|queue|approval|to approve|pending/.test(q)) return { answer: queueList(posts) };
  if (/not ready|blocked|problem|issue|fix|wrong|weak/.test(q)) return { answer: problems(posts) };
  if (/this week|next 7|next week|upcoming|schedule|calendar/.test(q)) return { answer: nextWeek(posts, now) };
  if (/summar|overview|status|how.*(doing|going|looking)/.test(q)) return { answer: summary(posts, brand, now) };
  if (post) return { answer: explain(post) };
  if (CHANNEL_WORDS.some(([re]) => re.test(q))) {
    const c = CHANNEL_WORDS.find(([re]) => re.test(q))![1];
    const list = posts.filter((p) => p.channel === c);
    return { answer: list.length ? `${channelLabel(c)} posts:\n${list.map((p) => `• ${lk(p)} — ${STATUS_LABEL[p.status].toLowerCase()}, ${p.readiness.score}/100`).join("\n")}` : `No ${channelLabel(c)} posts on the calendar.` };
  }
  return { answer: HELP };
}
