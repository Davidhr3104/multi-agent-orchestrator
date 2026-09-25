"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredLead } from "@helix/core";
import {
  initials,
  relativeTime,
  signalChips,
  tierLabel,
  tierTone,
} from "@/components/leads-engine/lead-ui";
import { cn } from "@/lib/utils";

const REPS = [
  { id: "rep-enterprise", name: "Sam Patel" },
  { id: "rep-ana", name: "Ana Ruiz" },
  { id: "rep-luis", name: "Luis Ortega" },
];

type InboxFilter = "all" | "borderline" | "info" | "ambiguous";

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = c * (1 - pct);
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#282a30" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 8px rgba(6,182,212,0.55))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold text-primary">{score}</span>
        <span className="text-[10px] font-bold tracking-wider text-outline uppercase">/ 100</span>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState("");
  const [undo, setUndo] = useState<{ ids: string[]; secondsLeft: number } | null>(null);
  const [undoLostId, setUndoLostId] = useState<string | null>(null);
  const undoTimerRef = useRef<{ interval: number; timeout: number } | null>(null);
  const undoLostTimerRef = useRef<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as { leads?: StoredLead[] };
    const queue = (data.leads ?? []).filter((l) => l.needsReview);
    setLeads(queue);
    setSelectedId((cur) => {
      if (cur && queue.some((l) => l.id === cur)) return cur;
      return queue[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Editable-field guard runs FIRST: inside an input/textarea/select (or contenteditable),
      // Ctrl/Cmd+Z must keep its native text-undo behavior and never trigger the approve undo.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && undo) {
        e.preventDefault();
        void undoApprove(undo.ids);
        return;
      }
      const sel = leads.find((l) => l.id === selectedId);
      if (!sel) return;
      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        void act(sel.id, "approve");
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        void act(sel.id, "archive");
      }
      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        const idx = leads.findIndex((l) => l.id === selectedId);
        if (idx < leads.length - 1) setSelectedId(leads[idx + 1].id);
      }
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        const idx = leads.findIndex((l) => l.id === selectedId);
        if (idx > 0) setSelectedId(leads[idx - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, selectedId, undo]);

  useEffect(() => {
    return () => {
      clearUndoTimer();
      if (undoLostTimerRef.current) {
        window.clearTimeout(undoLostTimerRef.current);
        undoLostTimerRef.current = null;
      }
    };
  }, []);

  const visible = useMemo(() => {
    return leads.filter((l) => {
      if (filter === "borderline") return l.score >= 40 && l.score < 75;
      if (filter === "info") return l.classification === "info";
      if (filter === "ambiguous") return !l.budget || l.budget.toLowerCase().includes("flex");
      return true;
    });
  }, [leads, filter]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  async function act(id: string, path: "approve" | "archive" | "crm") {
    setBusy(`${path}:${id}`);
    setError(null);
    try {
      const noteBody = note.trim() ? { note: note.trim() } : {};
      if (path === "approve") {
        const crm = await fetch(`/api/leads/${id}/crm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteBody),
        });
        if (!crm.ok) {
          const data = (await crm.json()) as { error?: string };
          setError(data.error || `CRM ${crm.status}`);
        } else {
          await fetch(`/api/leads/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(noteBody),
          });
          setNote("");
          startUndoWindow([id]);
        }
      } else if (path === "crm") {
        const res = await fetch(`/api/leads/${id}/crm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteBody),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error || `Failed (${res.status})`);
        } else {
          setNote("");
        }
      } else {
        const res = await fetch(`/api/leads/${id}/${path}`, { method: "POST" });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error || `Failed (${res.status})`);
        }
      }
      await refresh();
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } finally {
      setBusy(null);
    }
  }

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      window.clearInterval(undoTimerRef.current.interval);
      window.clearTimeout(undoTimerRef.current.timeout);
      undoTimerRef.current = null;
    }
  }

  function startUndoWindow(ids: string[]) {
    if (ids.length === 0) return;
    setUndo((cur) => {
      if (cur && (cur.ids.length !== ids.length || cur.ids.some((id) => !ids.includes(id)))) {
        // A different approve's undo window was still active — replacing it here would
        // silently strand it (CRM push already confirmed, no way back). Surface it
        // instead of failing silently.
        setUndoLostId(cur.ids.join(", "));
        if (undoLostTimerRef.current) window.clearTimeout(undoLostTimerRef.current);
        undoLostTimerRef.current = window.setTimeout(() => {
          setUndoLostId(null);
          undoLostTimerRef.current = null;
        }, 6000);
      }
      return cur;
    });
    clearUndoTimer();
    setUndo({ ids, secondsLeft: 5 });
    const interval = window.setInterval(() => {
      setUndo((cur) => {
        if (!cur || cur.ids.length !== ids.length || cur.ids.some((id) => !ids.includes(id))) return cur;
        const next = cur.secondsLeft - 1;
        return next > 0 ? { ids, secondsLeft: next } : cur;
      });
    }, 1000);
    const timeout = window.setTimeout(() => {
      clearUndoTimer();
      setUndo(null);
    }, 5000);
    undoTimerRef.current = { interval, timeout };
  }

  async function undoApprove(ids: string[]) {
    clearUndoTimer();
    setUndo(null);
    setError(null);
    const failures: string[] = [];
    for (const id of ids) {
      // .catch keeps a network failure from throwing out of the component; null = request never completed.
      const res = await fetch(`/api/leads/${id}/review`, { method: "DELETE" }).catch(() => null);
      if (!res) {
        failures.push(`${id}: network error`);
      } else if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        failures.push(`${id} (${res.status}${data.error ? `: ${data.error}` : ""})`);
      }
    }
    if (failures.length > 0) {
      setError(
        `Undo failed for ${failures.length} lead(s): ${failures.join("; ")} — the approve is still in effect for those.`
      );
    }
    await refresh();
    if (failures.length < ids.length) window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
  }

  async function assign(id: string, repId: string) {
    setBusy(`assign:${id}`);
    setError(null);
    const res = await fetch(`/api/leads/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repId }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error || `Assign failed (${res.status})`);
      return;
    }
    setOwner(repId);
    await refresh();
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(visibleIds: string[]) {
    setChecked((prev) => {
      const allChecked = visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allChecked) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function bulkAction(action: "archive" | "ghl") {
    const ids = [...checked];
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      action === "ghl"
        ? `Approve and push ${ids.length} lead(s) to CRM?`
        : `Archive ${ids.length} lead(s)?`
    );
    if (!confirmed) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        leads?: StoredLead[];
        errors?: { id: string; error: string }[];
      };
      const failCount = data.errors?.length ?? 0;
      const successIds = (data.leads ?? []).map((l) => l.id);
      if (action === "ghl" && successIds.length > 0) {
        // CRM-then-review contract established in Fase A Task 3: the bulk "ghl" action
        // only pushes to CRM, it does not clear needsReview — do that here per id.
        for (const id of successIds) {
          await fetch(`/api/leads/${id}/review`, { method: "POST" }).catch(() => null);
        }
        startUndoWindow(successIds);
      }
      if (failCount > 0) {
        setError(`${successIds.length} ok / ${failCount} failed`);
      }
      setChecked(new Set());
      await refresh();
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } finally {
      setBulkBusy(false);
    }
  }

  const filters: { id: InboxFilter; label: string; count: number }[] = [
    { id: "all", label: "All Pending", count: leads.length },
    {
      id: "borderline",
      label: "Borderline Score",
      count: leads.filter((l) => l.score >= 40 && l.score < 75).length,
    },
    {
      id: "info",
      label: "Info / Soft",
      count: leads.filter((l) => l.classification === "info").length,
    },
    {
      id: "ambiguous",
      label: "Ambiguous Budget",
      count: leads.filter((l) => !l.budget || l.budget.toLowerCase().includes("flex")).length,
    },
  ];

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Triage Inbox</h1>
            <span className="rounded-full bg-primary-container/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
              {leads.length} lead{leads.length === 1 ? "" : "s"} require human review
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
            <span>
              Queue · <strong className="text-error">{leads.length ? "ACTIVE" : "CLEAR"}</strong>
            </span>
            <span>
              SLA · <strong className="text-primary">&lt; 25m</strong>
            </span>
            <span>
              Model gate · <strong className="text-on-surface">HITL</strong>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-[10px] text-outline">
          {[
            ["A", "Approve"],
            ["D", "Disqualify"],
            ["J/K", "Navigate"],
          ].map(([k, v]) => (
            <span
              key={k}
              className="rounded-md border border-outline-variant/40 bg-surface-container px-2 py-1"
            >
              <kbd className="text-primary">{k}</kbd> {v}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-outline-variant/20">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-semibold transition",
              filter === f.id
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            )}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      {undoLostId ? (
        <div className="fixed right-4 bottom-[3.75rem] z-50 flex items-center gap-3 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-sm text-error shadow-lg">
          <span>
            Undo window for lead {undoLostId} closed early (another approve started) — that
            CRM push can no longer be undone.
          </span>
          <button
            type="button"
            onClick={() => setUndoLostId(null)}
            className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {undo ? (
        <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm text-on-surface shadow-lg">
          <span>
            {undo.ids.length > 1
              ? `Undo bulk approve (${undo.ids.length} leads)`
              : "Approved & pushed to CRM — undo reopens HITL only, not the CRM push"}{" "}
            ({undo.secondsLeft}s)
          </span>
          <button
            type="button"
            onClick={() => void undoApprove(undo.ids)}
            className="rounded bg-primary-container px-2 py-1 text-xs font-semibold text-on-primary-container"
          >
            Undo (Ctrl+Z)
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Stack */}
        <div className="lg:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-[0.16em] text-outline uppercase">
              Pending Inspection Stack
            </p>
            {visible.length > 0 ? (
              <label className="flex items-center gap-1.5 text-[10px] text-outline">
                <input
                  type="checkbox"
                  checked={visible.every((l) => checked.has(l.id))}
                  onChange={() => toggleAllVisible(visible.map((l) => l.id))}
                  aria-label="Select all visible leads"
                />
                Select all
              </label>
            ) : null}
          </div>
          {checked.size > 0 ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm">
              <span>{checked.size} selected</span>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void bulkAction("ghl")}
                className="rounded bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container disabled:opacity-50"
              >
                Approve &amp; Push
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void bulkAction("archive")}
                className="rounded bg-surface-container px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="ml-auto text-xs text-outline underline"
              >
                Clear
              </button>
            </div>
          ) : null}
          <ul className="space-y-2">
            {visible.length === 0 ? (
              <li className="rounded-xl border border-dashed border-outline-variant/40 px-4 py-10 text-center text-sm text-outline">
                Queue clear.
              </li>
            ) : (
              visible.map((lead) => {
                const active = lead.id === selectedId;
                const tone = tierTone(lead);
                return (
                  <li key={lead.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(lead.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(lead.id);
                        }
                      }}
                      className={cn(
                        "w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition",
                        active
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_24px_rgba(6,182,212,0.12)]"
                          : "border-outline-variant/25 bg-surface-container hover:bg-surface-container-high"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked.has(lead.id)}
                          onChange={() => toggleCheck(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${lead.name}`}
                          className="mt-1.5"
                        />
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-[11px] font-bold text-primary">
                          {initials(lead.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-on-surface">{lead.name}</p>
                            {active ? (
                              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary uppercase">
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-on-surface-variant">
                            {lead.company ?? lead.email}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                                tone === "review" && "bg-error-container/40 text-error",
                                tone === "hot" && "bg-tertiary-container/50 text-tertiary",
                                tone === "warm" && "bg-secondary-container/50 text-secondary",
                                tone !== "review" && tone !== "hot" && tone !== "warm" && "bg-surface-container-highest text-on-surface-variant"
                              )}
                            >
                              {lead.score}/100
                            </span>
                            <span className="text-[10px] text-outline">{relativeTime(lead.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Detail */}
        <div className="lg:col-span-8">
          {!selected ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low">
              <p className="text-sm text-outline">Select a lead from the stack.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-outline-variant/25 bg-surface-container p-5">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-4">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                      {initials(selected.name)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-on-surface">{selected.name}</h2>
                      <p className="text-sm text-on-surface-variant">
                        {selected.company ? `${selected.company} · ` : ""}
                        {selected.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {signalChips(selected).map((c) => (
                          <span
                            key={c}
                            className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[10px] text-on-surface-variant"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto sm:ml-auto sm:mr-0">
                    <ScoreRing score={selected.score} />
                    <p className="mt-1 text-center text-[10px] font-bold tracking-wider text-primary uppercase">
                      {tierLabel(selected)} · {Math.round(selected.confidence * 100)}% conf
                    </p>
                  </div>
                </div>

                {selected.confidence < 0.75 ? (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-on-surface-variant">
                    Confidence threshold breached ({selected.confidence.toFixed(2)} vs 0.75 target) — human review
                    required.
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(selected.fields ?? []).slice(0, 4).map((f) => (
                    <div key={f.key} className="rounded-lg bg-surface-container-low px-3 py-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-on-surface">{f.label}</span>
                        <span className="font-mono text-primary">{Math.round(f.confidence * 10) / 10}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(f.confidence * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-outline">{f.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-bold tracking-wider text-outline uppercase">Reasoning</p>
                  <blockquote className="mt-2 border-l-2 border-primary/50 pl-3 text-sm text-on-surface-variant">
                    {selected.reasoning || selected.message || "No reasoning captured."}
                  </blockquote>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/25 bg-surface-container p-5">
                <p className="mb-3 text-[10px] font-bold tracking-wider text-outline uppercase">
                  Operator Decision Console
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-on-surface-variant">
                    Assign owner
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-sm text-on-surface"
                      value={owner}
                      onChange={(e) => {
                        setOwner(e.target.value);
                        if (e.target.value) void assign(selected.id, e.target.value);
                      }}
                    >
                      <option value="">Unassigned</option>
                      {REPS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-on-surface-variant">
                    CRM note
                    <textarea
                      className="mt-1 h-9 w-full resize-none rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Auto note for CRM…"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void act(selected.id, "approve")}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-tertiary px-4 text-xs font-bold text-on-tertiary disabled:opacity-50 sm:flex-none"
                  >
                    Approve &amp; Route to CRM
                    <kbd className="ml-1 opacity-70">A</kbd>
                  </button>
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void act(selected.id, "crm")}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 text-xs font-bold text-on-surface disabled:opacity-50"
                  >
                    Push CRM only
                  </button>
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void act(selected.id, "archive")}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-error/40 bg-error-container/30 px-4 text-xs font-bold text-error disabled:opacity-50"
                  >
                    Mark Spam
                    <kbd className="ml-1 opacity-70">D</kbd>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
