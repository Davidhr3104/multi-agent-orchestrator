import type { AskAiActionProposal, StoredLead } from "@helix/core";

/**
 * Deterministic stand-in for Claude, used only when the desk is in demo mode
 * and no ANTHROPIC_API_KEY is configured. It never invents data: every name,
 * score, quote and id in a reply comes from the leads passed in, and every
 * proposed action points at a real lead id that the execute route can act on.
 */

export type DemoStageAction = {
  action: "advance_stage";
  stage: "contacted";
  targetIds: string[];
  note: string;
};

export type DemoSuggestion = {
  label: string;
  detail: string;
  recommended?: boolean;
  action: DemoStageAction;
};

/** A proposal plus the extra parameters some actions need (stage change, note text). */
export type DemoProposal = AskAiActionProposal & { stage?: string; note?: string };

export type DemoReply = {
  answer: string;
  proposal?: DemoProposal;
  /** True when the operator explicitly asked for the change (vs. asking a question). */
  command?: boolean;
  suggestions?: DemoSuggestion[];
};

const DAY_MS = 86_400_000;
const STALE_DAYS = 30;

function isActive(l: StoredLead) {
  return l.pipelineStage !== "lost" && l.classification !== "spam";
}

function daysOld(l: StoredLead, now: number) {
  return Math.floor((now - Date.parse(l.createdAt)) / DAY_MS);
}

function byScoreDesc(a: StoredLead, b: StoredLead) {
  return b.score - a.score;
}

function names(leads: StoredLead[]) {
  return leads.map((l) => l.name).join(", ");
}

function summary(active: StoredLead[], now: number): string {
  if (active.length === 0) {
    return "There are no leads in the pipeline right now. Ingest a lead or load the demo catalog to get started.";
  }
  const hot = active.filter((l) => l.tier === "hot").length;
  const warm = active.filter((l) => l.tier === "warm").length;
  const cold = active.filter((l) => l.tier === "cold").length;
  const avg = Math.round(active.reduce((s, l) => s + l.score, 0) / active.length);
  const top = [...active].sort(byScoreDesc).slice(0, 3);
  const review = active.filter((l) => l.needsReview);
  const stale = active.filter((l) => l.tier === "cold" && daysOld(l, now) > STALE_DAYS);

  const parts = [
    `Your pipeline has ${active.length} active leads: ${hot} hot, ${warm} warm and ${cold} cold, averaging ${avg} points.`,
    `${top[0].name} (${top[0].score}) leads${top.length > 1 ? `, followed by ${top
      .slice(1)
      .map((l) => `${l.name} (${l.score})`)
      .join(" and ")}` : ""}.`,
  ];
  if (review.length) parts.push(`${review.length} waiting for human review (${names(review)}).`);
  if (stale.length) parts.push(`${stale.length} idle for 30+ days (${names(stale)}).`);
  return parts.join(" ");
}

function explain(lead: StoredLead): string {
  const drivers = lead.fields
    .slice(0, 4)
    .map((f) => {
      const quote = f.verified && f.quote ? ` — “${f.quote}”` : "";
      return `• ${f.label}: ${f.value}${quote}`;
    })
    .join("\n");
  const state = lead.needsReview
    ? "It is currently flagged for human review."
    : `It is currently in the ${lead.pipelineStage ?? "new"} stage.`;
  return [
    `${lead.name} scored ${lead.score} (${lead.tier}) with ${Math.round(lead.confidence * 100)}% confidence.`,
    drivers ? `What drove it:\n${drivers}` : "",
    state,
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanup(active: StoredLead[], now: number): DemoReply {
  const candidates = active.filter((l) => l.tier === "cold" && daysOld(l, now) > STALE_DAYS);
  if (candidates.length === 0) {
    return { answer: "Nothing to clean up — every active lead has moved in the last 30 days." };
  }
  return {
    answer: `I checked the pipeline for cold leads with no movement in ${STALE_DAYS}+ days and found ${candidates.length}: ${names(candidates)}. Archiving keeps them out of your live metrics.`,
    proposal: {
      type: "action_proposal",
      action: "archive_leads",
      summary: `Archive ${candidates.length} stale lead${candidates.length === 1 ? "" : "s"}.`,
      targets: candidates.map((l) => ({
        id: l.id,
        label: `${l.name} (cold, idle ${daysOld(l, now)}d)`,
      })),
    },
  };
}

function reviewQueue(active: StoredLead[]): DemoReply {
  const queue = active.filter((l) => l.needsReview);
  if (queue.length === 0) {
    return { answer: "The human-review queue is clear — nothing is waiting on you." };
  }
  return {
    answer: `${queue.length} lead${queue.length === 1 ? " is" : "s are"} waiting in the review queue: ${queue
      .map((l) => `${l.name} (${l.score}, ${l.tier})`)
      .join(", ")}. Their scores landed in the mid-confidence band, so they need a person to sign off. Approving clears the flag and records who approved it.`,
    proposal: {
      type: "action_proposal",
      action: "approve_leads",
      summary: `Approve ${queue.length} lead${queue.length === 1 ? "" : "s"} from the review queue.`,
      targets: queue.map((l) => ({ id: l.id, label: `${l.name} (score ${l.score})` })),
    },
  };
}

function nextMove(active: StoredLead[]): DemoReply {
  const target = active
    .filter((l) => l.classification === "lead" && !l.needsReview && (l.pipelineStage === "new" || l.pipelineStage === "qualified"))
    .sort(byScoreDesc)[0];
  if (!target) {
    return { answer: "Every open lead is already contacted or waiting on review — no new plays to suggest right now." };
  }

  const urgent = /week|month|urgent|asap|today|tomorrow|soon/i.test(target.timeline ?? "") || target.score >= 90;
  const who = { id: target.id, label: target.name };
  const play = (label: string): DemoStageAction => ({
    action: "advance_stage",
    stage: "contacted",
    targetIds: [who.id],
    note: `Play chosen: ${label} (proposed by Helix AI)`,
  });
  const company = target.company ? `${target.company}'s` : "their";

  const suggestions: DemoSuggestion[] = [
    {
      label: "Fast-track call within 24h",
      detail: target.timeline
        ? `${target.name} said “${target.timeline}” — a same-day call captures that urgency before it cools off.`
        : `${target.name} is your strongest open lead — speed matters most here.`,
      recommended: urgent,
      action: play("Fast-track call within 24h"),
    },
    {
      label: "Send a tailored case study first",
      detail: `Lower-pressure: share a win close to ${company} situation, then follow up with a call in 2-3 days.`,
      recommended: !urgent,
      action: play("Send a tailored case study first"),
    },
    {
      label: "Loop in a senior rep for a joint call",
      detail: "Best for larger deals — adds credibility, but adds a scheduling step that may slow things down.",
      action: play("Loop in a senior rep for a joint call"),
    },
  ];
  const recommended = suggestions.find((s) => s.recommended)!;
  return {
    answer: `Your strongest open lead is ${target.name} (${target.score}). Here are 3 ways to move them forward — I'd go with “${recommended.label}”. Picking one moves ${target.name} to Contacted and logs the play on the lead.`,
    suggestions,
  };
}

/**
 * Resolve a lead mentioned in free text. Full name wins; otherwise a first or last name
 * ("Priya", "nair") counts when it identifies exactly one lead. Ambiguous partials return
 * `ambiguous` so the caller can ask instead of guessing (or silently falling back to the top lead).
 */
export function matchLead(q: string, leads: StoredLead[]): { lead?: StoredLead; ambiguous?: StoredLead[] } {
  const text = q.toLowerCase();
  const full = leads.find((l) => text.includes(l.name.toLowerCase()));
  if (full) return { lead: full };
  const words = new Set(text.match(/[\p{L}'-]+/gu) ?? []);
  const partial = leads.filter((l) =>
    l.name
      .toLowerCase()
      .split(/\s+/)
      .some((tok) => tok.length >= 3 && words.has(tok))
  );
  if (partial.length === 1) return { lead: partial[0] };
  if (partial.length > 1) return { ambiguous: partial };
  return {};
}

function findByName(q: string, leads: StoredLead[]) {
  return matchLead(q, leads).lead;
}

function unknownLead(name: string): DemoReply {
  return { answer: `I couldn't find a lead matching "${name}" in your active pipeline.` };
}

/** Explicit imperative requests. Returns null when the text is not one, so questions fall through. */
function command(text: string, q: string, active: StoredLead[], now: number): DemoReply | null {
  if (/^(please )?(clean ?up|archive)\b/.test(q) && !findByName(q, active)) {
    return { ...cleanup(active, now), command: true };
  }

  const move = q.match(/^(?:please )?(?:move|advance|mark)\s+(.+?)\s+(?:to|as)\s+(contacted|qualified)\b/);
  if (move) {
    const lead = findByName(move[1], active);
    if (!lead) return unknownLead(move[1]);
    return {
      answer: `Moving ${lead.name} to ${move[2]}.`,
      command: true,
      proposal: {
        type: "action_proposal",
        action: "advance_stage",
        stage: move[2],
        note: `Moved to ${move[2]} (requested via Helix AI)`,
        summary: `Move ${lead.name} to ${move[2]}.`,
        targets: [{ id: lead.id, label: lead.name }],
      },
    };
  }

  const note = text.match(/^(?:please )?(?:add (?:a )?)?note\s+(?:to|on|for)\s+(.+?)\s*[:\-–]\s*(.+)$/i);
  if (note) {
    const lead = findByName(note[1].toLowerCase(), active);
    if (!lead) return unknownLead(note[1]);
    return {
      answer: `Adding a note to ${lead.name}.`,
      command: true,
      proposal: {
        type: "action_proposal",
        action: "add_note",
        note: note[2].trim(),
        summary: `Add a note to ${lead.name}.`,
        targets: [{ id: lead.id, label: lead.name }],
      },
    };
  }
  return null;
}

const HELP =
  'I can summarize your pipeline, explain why a lead scored the way it did, work through the review queue, or suggest your next move. You can also tell me what to do — "Move Jordan Hale to contacted", "Clean up my stale leads", "Add a note to Maya Chen: …" — and I only stop to ask when a change is risky.';

export function buildDemoReply(question: string, leads: StoredLead[], now: number): DemoReply {
  const q = question.toLowerCase();
  const active = leads.filter(isActive);

  if (leads.length === 0) return { answer: summary([], now) };

  const cmd = command(question.trim(), q, active, now);
  if (cmd) return cmd;

  const { lead: named, ambiguous } = matchLead(q, active);
  if (named) return { answer: explain(named) };
  if (ambiguous) return { answer: `Which lead do you mean: ${names(ambiguous)}? Use the full name so I explain the right one.` };
  if (/highest score|top lead|best lead|strongest lead|why.*(score|scored)/.test(q)) {
    const top = [...active].sort(byScoreDesc)[0];
    if (top) return { answer: explain(top) };
  }
  if (/review|approve|hitl|pending|queue|needs attention/.test(q)) return reviewQueue(active);
  if (/stale|cold|idle|clean ?up|archive|inactive/.test(q)) return cleanup(active, now);
  if (/next move|next step|follow.?up|strategy|what should i do|best move/.test(q)) return nextMove(active);
  if (/pipeline|hot lead|summar|overview|how.*(doing|going)|status/.test(q)) return { answer: summary(active, now) };

  return { answer: HELP };
}
