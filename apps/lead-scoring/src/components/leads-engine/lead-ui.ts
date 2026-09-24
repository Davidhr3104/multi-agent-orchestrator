import type { StoredLead } from "@helix/core";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function medianScore(scores: number[]) {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function hotPct(leads: StoredLead[]) {
  if (leads.length === 0) return 0;
  const hot = leads.filter((l) => l.tier === "hot" && l.classification === "lead").length;
  return Math.round((hot / leads.length) * 100);
}

export function tierLabel(lead: StoredLead) {
  if (lead.classification === "spam") return "Filtered";
  if (lead.needsReview) return "Review";
  if (lead.tier === "hot") return "Tier 1";
  if (lead.tier === "warm") return "Warm ICP";
  return "Cold";
}

export function tierTone(lead: StoredLead): "hot" | "warm" | "cold" | "review" | "spam" {
  if (lead.classification === "spam") return "spam";
  if (lead.needsReview) return "review";
  if (lead.tier === "hot") return "hot";
  if (lead.tier === "warm") return "warm";
  return "cold";
}

export function signalChips(lead: StoredLead): string[] {
  const chips: string[] = [];
  if (lead.source) chips.push(lead.source);
  if (lead.company) chips.push(lead.company);
  if (lead.budget) chips.push(`Budget ${lead.budget}`);
  if (lead.timeline) chips.push(lead.timeline);
  for (const f of lead.fields?.slice(0, 2) ?? []) {
    if (f.label && !chips.includes(f.label)) chips.push(f.label);
  }
  return chips.slice(0, 4);
}

export function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function sanitizeLeadPayload(lead: StoredLead) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    source: lead.source,
    company: lead.company ?? null,
    score: lead.score,
    tier: lead.tier,
    classification: lead.classification,
    needsReview: lead.needsReview,
    confidence: lead.confidence,
    crmStatus: lead.crmStatus,
    pipelineStage: lead.pipelineStage ?? null,
    createdAt: lead.createdAt,
    fields: (lead.fields ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value,
      confidence: f.confidence,
      verified: f.verified,
    })),
  };
}

export async function ingestLeadStream(
  body: Record<string, unknown>,
  onLog?: (msg: string) => void
): Promise<StoredLead | null> {
  const res = await fetch("/api/leads/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lead: StoredLead | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!line) continue;
      const event = JSON.parse(line) as {
        type: string;
        lead?: StoredLead;
        message?: string;
        log?: { message: string };
      };
      if (event.type === "log" && event.log) onLog?.(event.log.message);
      if (event.type === "result" && event.lead) lead = event.lead;
      if (event.type === "error") throw new Error(event.message ?? "Ingest failed");
    }
  }
  return lead;
}
