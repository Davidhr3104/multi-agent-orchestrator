"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PipelineStage, StoredLead } from "@helix/core";
import {
  initials,
  relativeTime,
  sanitizeLeadPayload,
  signalChips,
  tierLabel,
  tierTone,
} from "@/components/leads-engine/lead-ui";
import { cn } from "@/lib/utils";

const STAGES: PipelineStage[] = ["new", "qualified", "contacted", "won", "lost"];

type RosterFilter = "all" | "hot" | "warm" | "review" | "filtered";

function matchesFilter(lead: StoredLead, filter: RosterFilter) {
  if (filter === "all") return true;
  if (filter === "hot") return lead.tier === "hot" && lead.classification === "lead";
  if (filter === "warm") return lead.tier === "warm" && lead.classification === "lead";
  if (filter === "review") return Boolean(lead.needsReview);
  if (filter === "filtered") return lead.classification === "spam" || lead.classification === "info";
  return true;
}

function ScorePill({ lead }: { lead: StoredLead }) {
  const tone = tierTone(lead);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold",
        tone === "hot" && "bg-tertiary-container/50 text-tertiary",
        tone === "warm" && "bg-secondary-container/50 text-secondary",
        tone === "cold" && "bg-surface-container-highest text-on-surface-variant",
        tone === "review" && "bg-error-container/40 text-error",
        tone === "spam" && "bg-outline-variant/30 text-outline"
      )}
    >
      {lead.score}
      <span className="opacity-70">·</span>
      {tierLabel(lead)}
    </span>
  );
}

function LiveInspect({
  lead,
  busy,
  draftEmail,
  slots,
  lookalikes,
  onPush,
  onRescore,
  onStage,
  onArchive,
  onClearReview,
  onDraftEmail,
  onOutreach,
  onMeeting,
  onLookalike,
  onClose,
}: {
  lead: StoredLead | null;
  busy: boolean;
  draftEmail: { subject: string; body: string } | null;
  slots: { label?: string; start?: string; url?: string }[];
  lookalikes: { id: string; name: string; score: number }[];
  onPush: () => void;
  onRescore: () => void;
  onStage: (stage: PipelineStage) => void;
  onArchive: () => void;
  onClearReview: () => void;
  onDraftEmail: () => void;
  onOutreach: () => void;
  onMeeting: () => void;
  onLookalike: () => void;
  onClose: () => void;
}) {
  if (!lead) {
    return (
      <aside className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-8 text-center">
        <span className="material-symbols-outlined text-[40px] text-outline">manage_search</span>
        <p className="mt-3 text-sm font-semibold text-on-surface">Live Inspect</p>
        <p className="mt-1 text-xs text-on-surface-variant">Select a lead from the roster.</p>
      </aside>
    );
  }

  const payload = sanitizeLeadPayload(lead);
  const stage = (lead.pipelineStage ?? "new") as PipelineStage;

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container">
      <div className="flex items-start justify-between border-b border-outline-variant/20 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">Live Inspect</p>
          <h2 className="mt-1 text-lg font-bold text-on-surface">{lead.name}</h2>
          <p className="text-xs text-on-surface-variant">
            {lead.company ? `${lead.company} · ` : ""}
            {lead.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-outline hover:bg-surface-container-high"
          aria-label="Close inspect"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="rounded-xl bg-surface-container-lowest p-5 text-center">
          <p className="text-[11px] font-bold tracking-wider text-outline uppercase">Intent Score</p>
          <p className="mt-1 font-mono text-5xl font-bold text-primary">{lead.score}</p>
          <div className="mt-2 flex justify-center">
            <ScorePill lead={lead} />
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Confidence {Math.round(lead.confidence * 100)}% · Engine {lead.engine}
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
            Pipeline stage
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy || stage === s}
                onClick={() => onStage(s)}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold uppercase transition",
                  stage === s
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
            Reasoning
          </h3>
          <p className="text-sm leading-relaxed text-on-surface-variant">{lead.reasoning}</p>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
            Signal Matrix
          </h3>
          <ul className="space-y-2">
            {(lead.fields ?? []).length === 0 ? (
              <li className="text-xs text-outline">No scored fields.</li>
            ) : (
              lead.fields.map((f) => (
                <li
                  key={f.key}
                  className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-on-surface">{f.label}</span>
                    <span className="font-mono text-[10px] text-primary">
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-on-surface-variant">{f.value}</p>
                </li>
              ))
            )}
          </ul>
        </div>

        {draftEmail ? (
          <div>
            <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
              Draft email
            </h3>
            <p className="text-xs font-semibold text-on-surface">{draftEmail.subject}</p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-lowest p-3 text-[11px] text-on-surface-variant">
              {draftEmail.body}
            </pre>
          </div>
        ) : null}

        {slots.length > 0 ? (
          <div>
            <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
              Meeting slots
            </h3>
            <ul className="space-y-1.5 text-xs text-on-surface-variant">
              {slots.slice(0, 5).map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2 py-1.5">
                  <span>{s.label ?? s.start ?? `Slot ${i + 1}`}</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Open
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lookalikes.length > 0 ? (
          <div>
            <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
              Lookalikes
            </h3>
            <ul className="space-y-1 text-xs">
              {lookalikes.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 text-on-surface-variant">
                  <span className="truncate text-on-surface">{l.name}</span>
                  <span className="font-mono text-primary">{l.score}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
            Trail
          </h3>
          <ul className="space-y-1.5 font-mono text-[11px] text-on-surface-variant">
            <li>CRM · {lead.crmStatus}</li>
            <li>Stage · {lead.pipelineStage ?? "new"}</li>
            <li>HITL · {lead.needsReview ? "pending" : "clear"}</li>
            <li>Route · {lead.routingReason ?? "—"}</li>
            <li>Ingested · {relativeTime(lead.createdAt)}</li>
            {(lead.scoreHistory ?? []).slice(-3).map((h, i) => (
              <li key={`${h.at}-${i}`}>
                Score {h.score} · {h.reason} · {relativeTime(h.at)}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">
            Payload
          </h3>
          <pre className="max-h-48 overflow-auto rounded-lg bg-surface-container-lowest p-3 font-mono text-[10px] leading-relaxed text-on-surface-variant">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      </div>

      <div className="space-y-2 border-t border-outline-variant/20 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onPush}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary-container disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            Push CRM
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRescore}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 text-xs font-bold text-on-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Re-score
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {lead.needsReview ? (
            <button
              type="button"
              disabled={busy}
              onClick={onClearReview}
              className="rounded-lg bg-tertiary/15 px-2.5 py-1.5 text-[11px] font-semibold text-tertiary disabled:opacity-50"
            >
              Clear HITL
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onDraftEmail}
            className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[11px] font-semibold text-on-surface disabled:opacity-50"
          >
            Draft email
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onOutreach}
            className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[11px] font-semibold text-on-surface disabled:opacity-50"
          >
            Outreach
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onMeeting}
            className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[11px] font-semibold text-on-surface disabled:opacity-50"
          >
            Meeting slots
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onLookalike}
            className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[11px] font-semibold text-on-surface disabled:opacity-50"
          >
            Lookalikes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onArchive}
            className="rounded-lg bg-error/15 px-2.5 py-1.5 text-[11px] font-semibold text-error disabled:opacity-50"
          >
            Archive
          </button>
        </div>
      </div>
    </aside>
  );
}

function LeadsRoster() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState<{ subject: string; body: string } | null>(null);
  const [slots, setSlots] = useState<{ label?: string; start?: string; url?: string }[]>([]);
  const [lookalikes, setLookalikes] = useState<{ id: string; name: string; score: number }[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as { leads?: StoredLead[] };
    setLeads(data.leads ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    function onRefresh() {
      void refresh();
    }
    window.addEventListener("helix:leads-refresh", onRefresh);
    return () => window.removeEventListener("helix:leads-refresh", onRefresh);
  }, [refresh]);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f === "hot" || f === "warm" || f === "review" || f === "filtered" || f === "all") {
      setFilter(f);
    }
    const focus = searchParams.get("focus");
    if (focus) setSelectedId(focus);
  }, [searchParams]);

  useEffect(() => {
    if (selectedId || leads.length === 0) return;
    const defaultHot = [...leads]
      .filter((l) => l.tier === "hot")
      .sort((a, b) => b.score - a.score)[0];
    setSelectedId(defaultHot?.id ?? leads[0]?.id ?? null);
  }, [leads, selectedId]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      hot: leads.filter((l) => matchesFilter(l, "hot")).length,
      warm: leads.filter((l) => matchesFilter(l, "warm")).length,
      review: leads.filter((l) => matchesFilter(l, "review")).length,
      filtered: leads.filter((l) => matchesFilter(l, "filtered")).length,
    }),
    [leads]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (!matchesFilter(lead, filter)) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.source.toLowerCase().includes(q) ||
        (lead.company ?? "").toLowerCase().includes(q) ||
        lead.id.toLowerCase().includes(q)
      );
    });
  }, [leads, filter, query]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function pushCrm() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/crm`, { method: "POST" });
      const data = (await res.json()) as { lead?: StoredLead; error?: string };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
      }
      if (!res.ok) {
        showToast(data.error || `CRM ${res.status}`);
        return;
      }
      if (selected.needsReview) {
        const reviewRes = await fetch(`/api/leads/${selected.id}/review`, { method: "POST" });
        const reviewData = (await reviewRes.json()) as { lead?: StoredLead };
        if (reviewData.lead) {
          setLeads((prev) => prev.map((l) => (l.id === reviewData.lead!.id ? reviewData.lead! : l)));
        }
      }
      showToast("Pushed to CRM");
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } finally {
      setBusy(false);
    }
  }

  async function rescore() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pipeline" }),
      });
      const data = (await res.json()) as { lead?: StoredLead; error?: string; mode?: string };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
        showToast(data.mode === "pipeline" ? "Re-scored via pipeline" : "Re-scored");
        window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
      } else {
        showToast(data.error || `Score ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStage(pipelineStage: PipelineStage) {
    if (!selected) return;
    setBusy(true);
    try {
      const body: { pipelineStage: PipelineStage; dealValue?: number } = { pipelineStage };
      if (pipelineStage === "won") {
        const raw = window.prompt("Deal value (required for won)", "5000");
        const dealValue = Number(raw);
        if (!Number.isFinite(dealValue) || dealValue <= 0) {
          showToast("Won requires a positive deal value.");
          return;
        }
        body.dealValue = dealValue;
      }
      const res = await fetch(`/api/leads/${selected.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { lead?: StoredLead; error?: string };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
        showToast(`Stage → ${pipelineStage}`);
        window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
      } else {
        showToast(data.error || `Stage ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function archiveLead() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/archive`, { method: "POST" });
      const data = (await res.json()) as { lead?: StoredLead; error?: string };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
        showToast("Archived");
        window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
      } else {
        showToast(data.error || `Archive ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearReview() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/review`, { method: "POST" });
      const data = (await res.json()) as { lead?: StoredLead; error?: string };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
        showToast("HITL cleared");
        window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
      } else {
        showToast(data.error || `Review ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function draftEmailForLead() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = (await res.json()) as {
        subject?: string;
        body?: string;
        error?: string;
        lead?: StoredLead;
      };
      if (data.subject && data.body) {
        setDraftEmail({ subject: data.subject, body: data.body });
        if (data.lead) {
          setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
        }
        showToast("Draft ready");
      } else {
        showToast(data.error || `Email ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function runOutreach() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/outreach`, { method: "POST" });
      const data = (await res.json()) as {
        subject?: string;
        body?: string;
        lead?: StoredLead;
        error?: string;
      };
      if (data.subject && data.body) {
        setDraftEmail({ subject: data.subject, body: data.body });
      }
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
      }
      showToast(data.error ? data.error : "Outreach draft saved");
    } finally {
      setBusy(false);
    }
  }

  async function loadMeeting() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/meeting`, { method: "POST" });
      const data = (await res.json()) as {
        slots?: { label?: string; start?: string; url?: string }[];
        lead?: StoredLead;
        error?: string;
        source?: string;
      };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? data.lead! : l)));
      }
      setSlots(data.slots ?? []);
      showToast(
        data.error
          ? data.error
          : `${data.slots?.length ?? 0} slots (${data.source ?? "heuristic"})`
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadLookalikes() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${selected.id}/lookalike`);
      const data = (await res.json()) as {
        likes?: { id: string; name: string; score: number }[];
        leads?: { id: string; name: string; score: number }[];
        error?: string;
      };
      const rows = data.likes ?? data.leads ?? [];
      setLookalikes(rows);
      showToast(data.error || `${rows.length} lookalikes`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setDraftEmail(null);
    setSlots([]);
    setLookalikes([]);
  }, [selectedId]);

  const filters: { id: RosterFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hot", label: "High Intent" },
    { id: "warm", label: "Warm ICP" },
    { id: "review", label: "Review Needed" },
    { id: "filtered", label: "Filtered Out" },
  ];

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase">
            Intelligence Stream
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">Lead Roster</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {counts.all} contacts · filters reflect real seed counts
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-outline">
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter roster…"
            className="h-10 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest pr-3 pl-10 text-sm text-on-surface outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              router.replace(`/leads?filter=${f.id}${selectedId ? `&focus=${selectedId}` : ""}`);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              filter === f.id
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                filter === f.id ? "bg-white/15" : "bg-surface-container-highest"
              )}
            >
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container">
            {loading ? (
              <p className="p-8 text-center text-sm text-outline">Loading roster…</p>
            ) : visible.length === 0 ? (
              <p className="p-8 text-center text-sm text-outline">No leads in this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 text-[10px] font-bold tracking-wider text-outline uppercase">
                      <th className="px-4 py-3 font-bold">Lead</th>
                      <th className="px-4 py-3 font-bold">Signals</th>
                      <th className="px-4 py-3 font-bold">Score</th>
                      <th className="px-4 py-3 font-bold">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {visible.map((lead) => {
                      const active = lead.id === selectedId;
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => {
                            setSelectedId(lead.id);
                            router.replace(`/leads?filter=${filter}&focus=${lead.id}`);
                          }}
                          className={cn(
                            "cursor-pointer transition",
                            active ? "bg-primary-container/15" : "hover:bg-surface-container-high/50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-[11px] font-bold text-primary">
                                {initials(lead.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-on-surface">{lead.name}</p>
                                <p className="truncate text-xs text-on-surface-variant">
                                  {lead.company ? `${lead.company} · ` : ""}
                                  {lead.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {signalChips(lead).map((chip) => (
                                <span
                                  key={chip}
                                  className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[10px] text-on-surface-variant"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ScorePill lead={lead} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-outline">
                            {relativeTime(lead.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <LiveInspect
            lead={selected}
            busy={busy}
            draftEmail={draftEmail}
            slots={slots}
            lookalikes={lookalikes}
            onPush={() => void pushCrm()}
            onRescore={() => void rescore()}
            onStage={(s) => void setStage(s)}
            onArchive={() => void archiveLead()}
            onClearReview={() => void clearReview()}
            onDraftEmail={() => void draftEmailForLead()}
            onOutreach={() => void runOutreach()}
            onMeeting={() => void loadMeeting()}
            onLookalike={() => void loadLookalikes()}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>

      {toast ? (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          <p className="text-sm text-outline">Loading roster…</p>
        </main>
      }
    >
      <LeadsRoster />
    </Suspense>
  );
}
