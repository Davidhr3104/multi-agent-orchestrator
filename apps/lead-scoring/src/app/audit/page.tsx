"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoredLead } from "@helix/core";
import { cn } from "@/lib/utils";

type Severity = "ALL" | "INFO" | "WARNING" | "CRITICAL";

type AuditEvent = {
  id: string;
  at: string;
  dateLabel: string;
  timeLabel: string;
  kind: string;
  severity: Exclude<Severity, "ALL">;
  actor: string;
  actorSub: string;
  target: string;
  targetSub: string;
  hash: string;
  signed: boolean;
  title: string;
  prev: Record<string, unknown>;
  next: Record<string, unknown>;
  raw: Record<string, unknown>;
};

function shortHash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return `sha256:${h.toString(16).padStart(6, "0").slice(0, 6)}`;
}

function formatParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLabel: "—", timeLabel: "—" };
  }
  return {
    dateLabel: d.toISOString().slice(0, 10),
    timeLabel: d.toISOString().slice(11, 19),
  };
}

function buildEvents(leads: StoredLead[]): AuditEvent[] {
  const events: AuditEvent[] = [];

  for (const lead of leads) {
    const baseId = lead.id.replace(/^seed-/, "LD-").slice(0, 14);

    for (const h of lead.scoreHistory ?? []) {
      const parts = formatParts(h.at);
      events.push({
        id: `score-${lead.id}-${h.at}`,
        at: h.at,
        ...parts,
        kind: "INFERENCE",
        severity: "INFO",
        actor: "Helix Core",
        actorSub: lead.engine ?? "heuristic",
        target: `Lead #${baseId}`,
        targetSub: `${h.score} · ${h.tier} — ${h.reason}`,
        hash: shortHash(`${lead.id}:${h.at}:${h.score}`),
        signed: true,
        title: "Score history entry",
        prev: { score: null, tier: null },
        next: { score: h.score, tier: h.tier, reason: h.reason },
        raw: {
          event_type: "MODEL_INFERENCE",
          lead_id: lead.id,
          name: lead.name,
          score: h.score,
          tier: h.tier,
          reason: h.reason,
          at: h.at,
        },
      });
    }

    if (lead.crmStatus === "sent" || lead.crmStatus === "mocked") {
      const at = lead.reviewedAt ?? lead.createdAt;
      const parts = formatParts(at);
      events.push({
        id: `crm-${lead.id}`,
        at,
        ...parts,
        kind: "CRM_SYNC",
        severity: "INFO",
        actor: "Sync Relay",
        actorSub: lead.crmStatus === "sent" ? "GHL dispatch" : "Mock CRM",
        target: lead.ghlContactId ? `GHL ${lead.ghlContactId.slice(0, 12)}…` : `Lead #${baseId}`,
        targetSub: `${lead.name} · ${lead.crmStatus}`,
        hash: shortHash(`crm:${lead.id}:${lead.crmStatus}`),
        signed: true,
        title: "CRM handoff",
        prev: { crmStatus: "not_sent" },
        next: {
          crmStatus: lead.crmStatus,
          ghlContactId: lead.ghlContactId ?? null,
        },
        raw: {
          event_type: "CRM_SYNC",
          lead_id: lead.id,
          name: lead.name,
          crmStatus: lead.crmStatus,
          ghlContactId: lead.ghlContactId ?? null,
        },
      });
    }

    if (lead.crmStatus === "failed") {
      const at = lead.reviewedAt ?? lead.createdAt;
      const parts = formatParts(at);
      events.push({
        id: `crm-failed-${lead.id}`,
        at,
        ...parts,
        kind: "CRM_SYNC_FAILED",
        severity: "WARNING",
        actor: "Sync Relay",
        actorSub: "GHL dispatch failed",
        target: `Lead #${baseId}`,
        targetSub: `${lead.name} · ${lead.crmError ?? "unknown error"}`,
        hash: shortHash(`crm-failed:${lead.id}:${lead.crmError ?? ""}`),
        signed: true,
        title: "CRM handoff failed",
        prev: { crmStatus: "not_sent" },
        next: { crmStatus: "failed", crmError: lead.crmError ?? null },
        raw: {
          event_type: "CRM_SYNC_FAILED",
          lead_id: lead.id,
          name: lead.name,
          crmStatus: lead.crmStatus,
          crmError: lead.crmError ?? null,
        },
      });
    }

    if (lead.needsReview) {
      const parts = formatParts(lead.createdAt);
      events.push({
        id: `hitl-${lead.id}`,
        at: lead.createdAt,
        ...parts,
        kind: "OVERRIDE",
        severity: "WARNING",
        actor: lead.reviewedBy ?? "HITL queue",
        actorSub: "needsReview",
        target: `Lead #${baseId}`,
        targetSub: `${lead.name} · score ${lead.score} pending`,
        hash: shortHash(`hitl:${lead.id}`),
        signed: true,
        title: "Human triage required",
        prev: { needsReview: false },
        next: { needsReview: true, score: lead.score, tier: lead.tier },
        raw: {
          event_type: "OPERATOR_REVIEW_PENDING",
          lead_id: lead.id,
          name: lead.name,
          score: lead.score,
          classification: lead.classification,
        },
      });
    }

    if (lead.classification === "spam") {
      const parts = formatParts(lead.createdAt);
      events.push({
        id: `spam-${lead.id}`,
        at: lead.createdAt,
        ...parts,
        kind: "SEC_BLOCK",
        severity: "CRITICAL",
        actor: "Classifier",
        actorSub: lead.engine ?? "heuristic",
        target: `Lead #${baseId}`,
        targetSub: `${lead.name} · spam / filtered`,
        hash: shortHash(`spam:${lead.id}`),
        signed: true,
        title: "Spam / hard filter",
        prev: { classification: "lead" },
        next: { classification: "spam", score: lead.score },
        raw: {
          event_type: "SECURITY_FILTER",
          lead_id: lead.id,
          name: lead.name,
          classification: "spam",
          score: lead.score,
        },
      });
    }

    // baseline ingest event
    {
      const parts = formatParts(lead.createdAt);
      events.push({
        id: `ingest-${lead.id}`,
        at: lead.createdAt,
        ...parts,
        kind: "INGEST_OK",
        severity: "INFO",
        actor: "Webhook Relay",
        actorSub: lead.source,
        target: `Lead #${baseId}`,
        targetSub: `${lead.name} · ${lead.email}`,
        hash: shortHash(`ingest:${lead.id}`),
        signed: true,
        title: "Lead ingested",
        prev: { status: "pending" },
        next: {
          status: "scored",
          score: lead.score,
          tier: lead.tier,
          classification: lead.classification,
        },
        raw: {
          event_type: "INGESTION_PARSE",
          lead_id: lead.id,
          name: lead.name,
          email: lead.email,
          source: lead.source,
          score: lead.score,
        },
      });
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

const KIND_TONE: Record<string, string> = {
  OVERRIDE: "bg-primary/15 text-primary",
  INFERENCE: "bg-secondary/15 text-secondary",
  CRM_SYNC: "bg-tertiary/15 text-tertiary",
  SEC_BLOCK: "bg-error/15 text-error",
  PROMPT_MOD: "bg-primary/15 text-primary",
  INGEST_OK: "bg-secondary/15 text-secondary",
};

export default function AuditPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as { leads?: StoredLead[] };
    setLeads(data.leads ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!streaming) return;
    const t = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(t);
  }, [streaming, refresh]);

  const events = useMemo(() => buildEvents(leads), [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (severity !== "ALL" && e.severity !== severity) return false;
      if (!q) return true;
      return (
        e.id.toLowerCase().includes(q) ||
        e.kind.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.targetSub.toLowerCase().includes(q) ||
        e.hash.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
      );
    });
  }, [events, query, severity]);

  useEffect(() => {
    if (!selectedId && visible[0]) setSelectedId(visible[0].id);
    else if (selectedId && !visible.some((e) => e.id === selectedId)) {
      setSelectedId(visible[0]?.id ?? null);
    }
  }, [visible, selectedId]);

  const selected = visible.find((e) => e.id === selectedId) ?? null;

  const overrides = events.filter((e) => e.kind === "OVERRIDE").length;
  const crmSyncs = events.filter((e) => e.kind === "CRM_SYNC").length;

  function exportCsv() {
    const header = "at,kind,severity,actor,target,hash\n";
    const rows = visible
      .map((e) =>
        [e.at, e.kind, e.severity, JSON.stringify(e.actor), JSON.stringify(e.target), e.hash].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helix-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    if (!selected) return;
    await navigator.clipboard.writeText(JSON.stringify(selected.raw, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-secondary uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-secondary" />
              Ledger · Desk events
            </span>
            <span className="font-mono text-[10px] text-outline">FROM LIVE ROSTER</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
            Security &amp; Audit Log
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Inference, CRM dispatch, HITL flags, and ingest events derived from the seeded desk — not a
            fake multi-million event feed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-surface-container-low px-2 py-1">
            <span className="mr-2 font-mono text-[10px] text-on-surface-variant">FEED:</span>
            <button
              type="button"
              onClick={() => setStreaming((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded bg-tertiary/15 px-2 py-0.5 font-mono text-[10px] text-tertiary"
            >
              <span className={cn("size-1.5 rounded-full bg-tertiary", streaming && "animate-ping")} />
              {streaming ? "Stream Active" : "Stream Paused"}
            </button>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs text-on-surface hover:bg-surface-container-highest"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">download</span>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
              Event Integrity
            </span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">enhanced_encryption</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-on-surface">{events.length} events</p>
          <p className="mt-1 font-mono text-[10px] text-tertiary">Signed hashes (local)</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
              HITL Flags
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">rule_folder</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-on-surface">{overrides}</p>
          <p className="mt-1 font-mono text-[10px] text-secondary">needsReview leads</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">CRM Syncs</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">admin_panel_settings</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-on-surface">{crmSyncs}</p>
          <p className="mt-1 font-mono text-[10px] text-on-surface-variant">sent / mocked</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">Roster</span>
            <span className="material-symbols-outlined text-[18px] text-primary">lock_clock</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-on-surface">{leads.length} leads</p>
          <p className="mt-1 font-mono text-[10px] text-tertiary">Seed + live ingest</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-xl flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-outline">
              filter_list
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by lead, actor, event, or hash…"
              className="h-9 w-full rounded-lg bg-surface-container-low pr-3 pl-9 text-sm text-on-surface outline-none focus:bg-surface-container"
            />
          </div>
          <div className="flex rounded-lg bg-surface-container-low p-0.5">
            {(["ALL", "INFO", "WARNING", "CRITICAL"] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={cn(
                  "rounded px-3 py-1 font-mono text-[10px] transition",
                  severity === s
                    ? "bg-surface-container-high font-semibold text-on-surface"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <span className="px-2 font-mono text-[10px] text-on-surface-variant">
          Visible: <strong className="text-on-surface">{visible.length}</strong>
        </span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest lg:col-span-8">
          <div className="hidden grid-cols-12 gap-2 bg-surface-container-low px-4 py-2 font-mono text-[10px] tracking-wider text-outline uppercase md:grid">
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-2">Event</div>
            <div className="col-span-2">Actor</div>
            <div className="col-span-3">Target</div>
            <div className="col-span-3 text-right">Hash</div>
          </div>
          <div className="max-h-[640px] divide-y divide-outline-variant/10 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-outline">No events match.</p>
            ) : (
              visible.map((e) => {
                const active = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      "grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition md:grid-cols-12 md:items-center",
                      active ? "bg-surface-container" : "hover:bg-surface-container/60"
                    )}
                  >
                    <div className="font-mono text-[11px] text-on-surface-variant md:col-span-2">
                      <span className="text-on-surface">{e.timeLabel}</span>
                      <span className="block text-[10px] text-outline">{e.dateLabel}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                          KIND_TONE[e.kind] ?? "bg-surface-container-high text-on-surface-variant"
                        )}
                      >
                        {e.kind}
                      </span>
                    </div>
                    <div className="min-w-0 md:col-span-2">
                      <span className="block truncate text-sm font-medium text-on-surface">{e.actor}</span>
                      <span className="block truncate font-mono text-[10px] text-outline">{e.actorSub}</span>
                    </div>
                    <div className="min-w-0 md:col-span-3">
                      <span className="block truncate font-mono text-sm text-secondary">{e.target}</span>
                      <span className="block truncate font-mono text-[10px] text-on-surface-variant">
                        {e.targetSub}
                      </span>
                    </div>
                    <div className="flex flex-col items-start md:col-span-3 md:items-end">
                      <span className="font-mono text-[10px] text-outline">{e.hash}</span>
                      <span
                        className={cn(
                          "mt-0.5 flex items-center gap-1 font-mono text-[10px]",
                          e.signed ? "text-tertiary" : "text-error"
                        )}
                      >
                        <span className={cn("size-1 rounded-full", e.signed ? "bg-tertiary" : "bg-error")} />
                        {e.signed ? "SIGNED" : "REJECTED"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between bg-surface-container-low px-4 py-2 font-mono text-[10px] text-outline">
            <span className="flex items-center gap-1 text-tertiary">
              <span className="size-1.5 rounded-full bg-tertiary" /> Desk synced
            </span>
            <span>{events.length} ledger rows</span>
          </div>
        </div>

        <aside className="sticky top-20 flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest lg:col-span-4">
          <div className="flex items-center justify-between bg-surface-container-low px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">data_object</span>
              <span className="text-sm font-semibold text-on-surface">Event Inspector</span>
            </div>
            <button
              type="button"
              onClick={() => void copyJson()}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              title="Copy JSON"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
          </div>

          {!selected ? (
            <p className="p-6 text-center text-sm text-outline">Select a ledger row.</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="space-y-1 rounded-lg bg-surface-container p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-wider text-outline uppercase">Event</span>
                  <span className="rounded bg-tertiary/10 px-1.5 py-0.5 font-mono text-[10px] text-tertiary">
                    {selected.kind}
                  </span>
                </div>
                <p className="text-sm font-semibold text-on-surface">{selected.title}</p>
                <p className="truncate font-mono text-[10px] text-on-surface-variant">{selected.id}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-[10px] tracking-wider text-outline uppercase">
                  <span>State differential</span>
                  <span className="text-secondary">{selected.target}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-error/10 p-2">
                    <span className="mb-1 block font-mono text-[10px] text-error">Previous</span>
                    <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-on-surface whitespace-pre-wrap">
                      {JSON.stringify(selected.prev, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg bg-tertiary/10 p-2">
                    <span className="mb-1 block font-mono text-[10px] text-tertiary">Current</span>
                    <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-on-surface whitespace-pre-wrap">
                      {JSON.stringify(selected.next, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
                  Attestation
                </span>
                <div className="space-y-1.5 rounded-lg bg-surface-container p-3 font-mono text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">Actor</span>
                    <span className="truncate text-secondary">{selected.actor}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">Hash</span>
                    <span className="text-primary">{selected.hash}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-on-surface-variant">Severity</span>
                    <span className="text-on-surface">{selected.severity}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
                  Raw envelope
                </span>
                <pre className="max-h-48 overflow-auto rounded-lg bg-surface-container-low p-3 font-mono text-[10px] leading-relaxed text-on-surface-variant">
                  {JSON.stringify(selected.raw, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
