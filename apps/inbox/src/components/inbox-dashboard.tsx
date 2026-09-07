"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Search, Zap } from "lucide-react";
import type { InboxMessage, ThreadMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { EducationalEmpty } from "@/components/educational-empty";
import { INBOX_HELP, EMPTY_INBOX } from "@helix/help";

type FilterTab = "all" | "urgent" | "review" | "routed" | "blocked";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function filterFromHash(): FilterTab {
  if (typeof window === "undefined") return "all";
  const h = window.location.hash.replace("#", "");
  if (h === "routed" || h === "blocked" || h === "queue") {
    return h === "queue" ? "review" : h;
  }
  return "all";
}

export function InboxDashboard() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [history, setHistory] = useState<ThreadMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"memory" | "supabase">("memory");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([]);
  const [form, setForm] = useState({
    fromName: "",
    fromEmail: "",
    subject: "",
    body: "",
  });

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function refresh() {
    setError(null);
    try {
      const [msgRes, wsRes] = await Promise.all([fetch("/api/messages"), fetch("/api/workspace")]);
      const data = (await msgRes.json()) as { messages?: InboxMessage[]; error?: string };
      if (!msgRes.ok) throw new Error(data.error || `HTTP ${msgRes.status}`);
      const rows = data.messages ?? [];
      setMessages(rows);
      setSelectedId((id) => {
        if (id && rows.some((m) => m.id === id)) return id;
        return rows.find((m) => m.needsReview)?.id ?? rows[0]?.id ?? null;
      });
      if (wsRes.ok) {
        const ws = (await wsRes.json()) as { persistence?: "memory" | "supabase" };
        if (ws.persistence) setPersistence(ws.persistence);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(id: string) {
    const res = await fetch(`/api/messages/${id}`);
    const data = (await res.json()) as { history?: ThreadMessage[] };
    setHistory(data.history ?? []);
  }

  useEffect(() => {
    setFilter(filterFromHash());
    void refresh();
    void fetch("/api/preferences")
      .then((r) => r.json())
      .then((d: { preferences?: { templates?: { id: string; name: string; body: string }[] } }) => {
        setTemplates(d.preferences?.templates ?? []);
      })
      .catch(() => undefined);
    function onHash() {
      setFilter(filterFromHash());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadHistory(selectedId);
      void fetch(`/api/messages/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      }).then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { message?: InboxMessage };
        if (data.message) {
          setMessages((prev) => prev.map((m) => (m.id === selectedId ? data.message! : m)));
        }
      });
    } else setHistory([]);
  }, [selectedId]);

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  const stats = useMemo(() => {
    const review = messages.filter((m) => m.needsReview).length;
    const urgent = messages.filter((m) => m.priority === "urgent" || m.sentiment === "urgent").length;
    const blocked = messages.filter((m) => m.category === "spam" || m.status === "blocked").length;
    return { review, urgent, blocked, total: messages.length };
  }, [messages]);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (filter === "urgent" && !(m.priority === "urgent" || m.sentiment === "urgent")) return false;
      if (filter === "review" && !m.needsReview) return false;
      if (filter === "routed" && m.status !== "routed") return false;
      if (filter === "blocked" && !(m.status === "blocked" || m.category === "spam")) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        m.subject.toLowerCase().includes(q) ||
        m.fromName.toLowerCase().includes(q) ||
        m.fromEmail.toLowerCase().includes(q)
      );
    });
  }, [messages, filter, query]);

  async function ingest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { message?: InboxMessage; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error || `HTTP ${res.status}`);
      setForm({ fromName: "", fromEmail: "", subject: "", body: "" });
      setSelectedId(data.message.id);
      flash(`Triaged · ${data.message.category} · ${data.message.urgencyScore}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(
    id: string,
    action: "approve" | "route" | "block" | "snooze" | "smart_reply" | "star"
  ) {
    setActionBusy(action);
    setError(null);
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json()) as { message?: InboxMessage; error?: string };
    setActionBusy(null);
    if (!res.ok) {
      setError(data.error || `Action failed (${res.status})`);
      return;
    }
    flash(
      action === "approve"
        ? "Draft approved"
        : action === "route"
          ? "Routed"
          : action === "block"
            ? "Blocked"
            : action === "snooze"
              ? "Snoozed"
              : action === "star"
                ? data.message?.isStarred
                  ? "Starred"
                  : "Unstarred"
                : "Reply regenerated"
    );
    if (action === "snooze") {
      await refresh();
      return;
    }
    if (data.message) setMessages((prev) => prev.map((m) => (m.id === id ? data.message! : m)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("inbox-filter")?.focus();
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const ids = filtered.map((m) => m.id);
        if (ids.length === 0) return;
        const idx = selectedId ? ids.indexOf(selectedId) : -1;
        const next =
          e.key === "j"
            ? ids[Math.min(ids.length - 1, Math.max(0, idx + 1))]
            : ids[Math.max(0, idx <= 0 ? 0 : idx - 1)];
        setSelectedId(next);
        return;
      }
      if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        document.querySelector<HTMLElement>("[data-tour='inbox-inspector']")?.focus();
        return;
      }
      if (e.key.toLowerCase() === "r" && selectedId) {
        e.preventDefault();
        void act(selectedId, "smart_reply");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId]);

  async function bulk(action: "route" | "block" | "approve") {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setActionBusy(action);
    const res = await fetch("/api/messages/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    setActionBusy(null);
    if (!res.ok) {
      setError("Bulk action failed");
      return;
    }
    setSelectedIds(new Set());
    flash(`Bulk ${action}: ${ids.length}`);
    await refresh();
  }

  async function applyTemplate(body: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/messages/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftReply: body }),
    });
    const data = (await res.json()) as { message?: InboxMessage };
    if (data.message) setMessages((prev) => prev.map((m) => (m.id === selectedId ? data.message! : m)));
    flash("Template applied");
  }

  return (
    <main className="space-y-6 px-8 py-6">
      {toast ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg border border-[#8B5CF6]/30 bg-surface px-4 py-2 text-xs font-medium text-accent dark:text-[#E9D5FF] shadow-xl backdrop-blur-md">
          {toast}
        </div>
      ) : null}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inbox triage</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rank, draft, and route emails with autonomous multi-agent assistance
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">· {persistence}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md transition-all hover:border-[#8B5CF6]/40 hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("ingest-from-name")?.focus()}
            className="shimmer-button flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#4E5FF7] via-[#6366F1] to-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_18px_rgba(124,58,237,0.45)] transition-all hover:from-[#4352EA] hover:to-[#7C3AED] hover:shadow-[0_6px_24px_rgba(139,92,246,0.6)] active:scale-[0.98]"
          >
            <Plus className="size-3.5" />
            New Email
          </button>
        </div>
      </div>

      <section data-tour="inbox-metrics" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open threads */}
        <div className="metric-card-interactive group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[rgba(16,10,29,0.65)] dark:shadow-none dark:backdrop-blur-xl">
          <div className="pointer-events-none absolute top-0 right-0 size-24 rounded-full bg-violet-500/10 blur-xl transition-all group-hover:bg-violet-500/20 dark:bg-[#8B5CF6]/10" />
          <span className="relative flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-[#9CA3AF]">
            <span className="size-1.5 rounded-full bg-violet-500 dark:bg-[#8B5CF6]" />
            Open threads
            <InfoTooltip content={INBOX_HELP.openThreads} side="bottom" label="About open threads" />
          </span>
          <div className="relative mt-3 flex items-baseline justify-between">
            <span className="text-[32px] leading-none font-bold tracking-tight text-slate-900 dark:text-[#F9FAFB]">
              {stats.total}
            </span>
          </div>
        </div>

        {/* Need review */}
        <div className="metric-card-interactive group relative overflow-hidden rounded-xl border border-amber-200/80 border-l-[3px] border-l-amber-500 bg-white p-5 shadow-sm dark:border-[#F59E0B]/25 dark:border-l-[#F59E0B] dark:bg-[rgba(16,10,29,0.65)] dark:shadow-none dark:backdrop-blur-xl dark:hover:border-[#F59E0B]/40">
          <div className="pointer-events-none absolute top-0 right-0 size-24 rounded-full bg-amber-400/15 blur-xl dark:bg-[#F59E0B]/08" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-700 uppercase dark:text-[#FCD34D]">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500 dark:bg-[#F59E0B]" />
              Need review
              <InfoTooltip content={INBOX_HELP.needReview} side="bottom" label="About need review" />
            </span>
            <span className="shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-800 dark:border-[#F59E0B]/20 dark:bg-[#F59E0B]/10 dark:text-[#FBBF24]">
              Awaiting EA
            </span>
          </div>
          <p className="relative mt-3 text-[32px] leading-none font-bold tracking-tight text-slate-900 dark:text-[#F9FAFB]">
            {stats.review}
          </p>
        </div>

        {/* Urgent */}
        <div className="metric-card-interactive group relative overflow-hidden rounded-xl border border-red-200/80 border-l-[3px] border-l-red-500 bg-white p-5 shadow-sm dark:border-[#EF4444]/25 dark:border-l-[#EF4444] dark:bg-[rgba(16,10,29,0.65)] dark:shadow-none dark:backdrop-blur-xl dark:hover:border-[#EF4444]/40">
          <div className="pointer-events-none absolute top-0 right-0 size-24 rounded-full bg-red-400/15 blur-xl dark:bg-[#EF4444]/08" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-red-600 uppercase dark:text-[#FCA5A5]">
              <span className="animate-urgent-ring size-1.5 rounded-full bg-red-500 dark:bg-[#EF4444]" />
              Urgent
              <InfoTooltip content={INBOX_HELP.urgent} side="bottom" label="About urgent threads" />
            </span>
            <span className="shrink-0 rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[10px] font-medium text-red-700 dark:border-[#EF4444]/25 dark:bg-[#EF4444]/15 dark:text-[#F87171]">
              &lt; 1h SLA
            </span>
          </div>
          <p className="relative mt-3 text-[32px] leading-none font-bold tracking-tight text-red-700 dark:text-[#FEE2E2]">
            {stats.urgent}
          </p>
        </div>

        {/* Blocked */}
        <div className="metric-card-interactive relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[rgba(16,10,29,0.65)] dark:shadow-none dark:backdrop-blur-xl">
          <span className="relative flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-[#9CA3AF]">
            <span className="size-1.5 rounded-full bg-slate-400 dark:bg-[#6B7280]" />
            Blocked
            <InfoTooltip content={INBOX_HELP.blocked} side="bottom" label="About blocked threads" />
          </span>
          <div className="relative mt-3 flex items-baseline justify-between">
            <span className="text-[32px] leading-none font-bold tracking-tight text-slate-900 dark:text-[#F9FAFB]">
              {stats.blocked}
            </span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-[#6B7280]">
              {stats.blocked} spam
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section id="queue" data-tour="inbox-queue" className="glass-panel flex flex-col overflow-hidden rounded-xl lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface-muted/40 px-5 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                Queue
                <span className="size-2 rounded-full bg-[#8B5CF6]/60" />
                <InfoTooltip content={INBOX_HELP.queue} side="bottom" label="About the queue" />
              </h2>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1 text-xs font-medium dark:border-white/[0.04] dark:bg-[#05030A]/60">
                {(
                  [
                    ["all", "All"],
                    ["urgent", "Urgent"],
                    ["review", "Needs Review"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={cn(
                      "rounded-md px-3 py-1 transition-all",
                      filter === id
                        ? "bg-white font-semibold text-foreground shadow-sm dark:bg-white/[0.08] dark:shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.12)]"
                        : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/[0.03] dark:hover:text-[#9CA3AF]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative w-52">
              <Search className="absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
              <input
                id="inbox-filter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter threads (⌘K)..."
                className="input-glow w-full rounded-lg border border-border bg-surface-muted py-1.5 pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground transition-all"
              />
            </div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/5 px-4 py-2">
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground"
                  onClick={() => void bulk("approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground"
                  onClick={() => void bulk("route")}
                >
                  Route
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] text-red-600"
                  onClick={() => void bulk("block")}
                >
                  Block
                </button>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </button>
              </div>
            ) : null}
            {loading ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">Loading threads…</div>
            ) : filtered.length === 0 ? (
              <EducationalEmpty copy={EMPTY_INBOX.queue} />
            ) : (
              filtered.map((m) => {
              const on = m.id === selectedId;
              const blocked = m.status === "blocked" || m.category === "spam";
              const checked = selectedIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "queue-row flex w-full items-center gap-2 px-4 py-5 text-left transition-all",
                    on && "border-l-2 border-l-[#8B5CF6] bg-gradient-to-r from-[#8B5CF6]/[0.05] to-transparent",
                    blocked && "opacity-45 hover:opacity-75",
                    !m.isRead && "bg-accent/[0.03]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`Select ${m.subject}`}
                    className="accent-indigo-500"
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(m.id);
                        else next.delete(m.id);
                        return next;
                      });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3"
                  >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl border font-mono text-xs font-semibold",
                          blocked
                            ? "border-border bg-surface-muted text-muted-foreground"
                            : "border-[#8B5CF6]/30 bg-gradient-to-tr from-[#3D4DF5]/20 to-[#8B5CF6]/30 text-accent dark:text-[#DDD6FE] shadow-sm"
                        )}
                      >
                        {initials(m.fromName)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={cn(
                            "truncate text-sm font-semibold text-foreground",
                            blocked && "font-medium text-muted-foreground line-through decoration-[#6B7280]/50"
                          )}
                        >
                          {m.subject}
                        </h3>
                        {m.priority === "urgent" ? (
                          <span className="shrink-0 rounded-full border border-[#EF4444]/25 bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-[#F87171]">
                            Urgent
                          </span>
                        ) : m.needsReview ? (
                          <span className="shrink-0 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-[#FBBF24]">
                            Review
                          </span>
                        ) : blocked ? (
                          <span className="rounded border border-[#EF4444]/25 bg-[#EF4444]/15 px-1.5 text-[9px] font-mono text-red-600 dark:text-[#EF4444] uppercase">
                            Blocked
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2 truncate text-xs text-muted-foreground">
                        <span className="font-medium text-accent dark:text-purple-200">{m.fromName}</span>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="rounded border border-[#8B5CF6]/25 bg-[#8B5CF6]/15 px-1.5 py-0.5 font-mono text-[10px] text-accent dark:text-[#C4B5FD]">
                          {m.kind}
                        </span>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="rounded border border-[#6366F1]/25 bg-[#6366F1]/15 px-1.5 py-0.5 font-mono text-[10px] text-indigo-600 dark:text-[#A5B4FC]">
                          {m.status}
                        </span>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="text-muted-foreground">{relativeTime(m.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-mono-numbers shrink-0 px-1.5 py-1 text-xs font-medium tabular-nums",
                      m.urgencyScore >= 90
                        ? "text-[rgba(16,185,129,0.85)]"
                        : "text-muted-foreground"
                    )}
                  >
                    {String(m.urgencyScore).padStart(2, "0")}
                  </div>
                  </button>
                </div>
              );
            })
            )}
          </div>
        </section>

        <div className="space-y-6 lg:col-span-4">
          <section
            data-tour="inbox-ingest"
            className="glass-panel relative overflow-hidden rounded-xl p-5 shadow-xl transition-all hover:border-[#8B5CF6]/40"
          >
            <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-[#3D4DF5] via-[#8B5CF6] to-[#C084FC]" />
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                Ingest thread
                <span className="size-1.5 animate-ping rounded-full bg-[#8B5CF6]" />
                <InfoTooltip content={INBOX_HELP.ingest} side="left" label="About ingest" />
              </h2>
              <button
                type="button"
                className="text-xs font-medium text-accent transition-colors hover:text-accent dark:text-[#C4B5FD]"
                onClick={() => setForm({ fromName: "", fromEmail: "", subject: "", body: "" })}
              >
                Clear
              </button>
            </div>
            <p className="mb-4 text-[13px] text-muted-foreground">Paste an email to score and draft automatically</p>
            <form className="space-y-3" onSubmit={(e) => void ingest(e)}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold tracking-wider text-accent dark:text-[#C4B5FD] uppercase">
                    From name
                  </label>
                  <input
                    id="ingest-from-name"
                    required
                    value={form.fromName}
                    onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                    className="input-glow w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                    placeholder="e.g. Maya Chen"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold tracking-wider text-accent dark:text-[#C4B5FD] uppercase">
                    From email
                  </label>
                  <input
                    required
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                    className="input-glow w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                    placeholder="maya@northwindhvac.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold tracking-wider text-accent dark:text-[#C4B5FD] uppercase">
                  Subject
                </label>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="input-glow w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                  placeholder="Subject line..."
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold tracking-wider text-accent dark:text-[#C4B5FD] uppercase">
                  Body
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="input-glow w-full resize-none rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                  placeholder="Paste email content..."
                />
              </div>
              {error ? <p className="text-[11px] text-red-600 dark:text-[#FCA5A5]">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="shimmer-button flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#4E5FF7] via-[#6366F1] to-[#8B5CF6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(124,58,237,0.4)] transition-all hover:from-[#3D4DF5] hover:to-[#7C3AED] hover:shadow-[0_6px_24px_rgba(139,92,246,0.6)] active:scale-[0.99] disabled:opacity-50"
              >
                <Zap className="size-4" />
                {busy ? "Scoring…" : "Triage with AI"}
              </button>
            </form>
          </section>

          {selected ? (
            <section
              data-tour="inbox-inspector"
              tabIndex={-1}
              className="glass-panel relative overflow-hidden rounded-xl border-[#8B5CF6]/35 p-5 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] outline-none"
            >
              <div className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-[#8B5CF6]/15 blur-2xl" />
              <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                  <h3 className="text-sm font-semibold text-foreground">Active inspector</h3>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#10B981]/40 bg-gradient-to-r from-[#10B981]/20 to-[#059669]/20 px-2.5 py-1 text-emerald-700 dark:text-[#34D399] shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]">
                  <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">Match</span>
                  <span className="font-mono text-xs font-bold">{selected.urgencyScore}%</span>
                </div>
              </div>
              <h4 className="mb-1 text-sm leading-snug font-semibold text-foreground">{selected.subject}</h4>
              <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-accent dark:text-purple-200">{selected.fromName}</span>
                <span className="text-muted-foreground">&lt;{selected.fromEmail}&gt;</span>
                <span className="text-muted-foreground/70">·</span>
                <span className="text-muted-foreground">{relativeTime(selected.createdAt)}</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#34D399]">
                  {categoryLabel(selected.category)}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent dark:text-[#DDD6FE]">
                  <span className="size-1.5 rounded-full bg-[#8B5CF6]" />
                  {selected.sentiment}
                </span>
                {selected.priority === "urgent" ? (
                  <span className="flex items-center gap-1 rounded-full border border-[#DC2626]/25 bg-[rgba(220,38,38,0.1)] px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-[#F87171]">
                    High Urgency
                  </span>
                ) : null}
              </div>
              <div className="mb-2 flex items-center gap-1.5 text-xs text-foreground/80">
                <span className="text-muted-foreground">Route target:</span>
                <span className="rounded border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2 py-0.5 font-medium text-accent dark:text-[#C4B5FD]">
                  {selected.routeTo}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#8B5CF6]/20 bg-gradient-to-r from-surface-muted to-accent/5 dark:from-[#080412]/80 dark:to-[#140D26]/80 p-3 text-xs text-foreground/80 italic shadow-inner">
                <span>&ldquo;{selected.reasoning}&rdquo;</span>
              </div>
              {selected.draftReply ? (
                <p className="mb-3 rounded-lg border border-border bg-surface-muted p-3 text-[11px] leading-relaxed text-muted-foreground not-italic">
                  {selected.draftReply}
                </p>
              ) : null}
              {templates.length > 0 ? (
                <div className="mb-3">
                  <label className="mb-1 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Apply template
                  </label>
                  <select
                    className="input-glow w-full rounded-md border border-border bg-surface-muted px-2 py-1.5 text-xs text-foreground"
                    defaultValue=""
                    onChange={(e) => {
                      const tpl = templates.find((t) => t.id === e.target.value);
                      if (tpl) void applyTemplate(tpl.body);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Choose template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {history.length > 1 ? (
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">
                  Thread context · {history.length} messages
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="btn-tactile h-8 rounded-md bg-gradient-to-r from-[#4E5FF7] to-[#8B5CF6] px-3 text-[11px] font-semibold text-white disabled:opacity-50"
                  onClick={() => void act(selected.id, "approve")}
                >
                  {actionBusy === "approve" ? "…" : "Approve draft"}
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] text-foreground disabled:opacity-50"
                  onClick={() => void act(selected.id, "route")}
                >
                  {actionBusy === "route" ? "…" : "Route"}
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="btn-tactile h-8 rounded-md border border-accent/40 px-3 text-[11px] text-accent disabled:opacity-50"
                  onClick={() => void act(selected.id, "smart_reply")}
                >
                  {actionBusy === "smart_reply" ? "Drafting…" : "Regen reply"}
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="btn-tactile h-8 rounded-md border border-amber-500/30 px-3 text-[11px] text-amber-700 dark:text-[#FBBF24] disabled:opacity-50"
                  onClick={() => void act(selected.id, "snooze")}
                >
                  {actionBusy === "snooze" ? "…" : "Snooze"}
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] text-accent disabled:opacity-50"
                  onClick={() => void act(selected.id, "star")}
                >
                  {selected.isStarred ? "Unstar" : "Star"}
                </button>
                <button
                  type="button"
                  disabled={actionBusy != null}
                  className="btn-tactile h-8 rounded-md border border-red-500/30 px-3 text-[11px] text-red-600 dark:text-[#FCA5A5] disabled:opacity-50"
                  onClick={() => void act(selected.id, "block")}
                >
                  {actionBusy === "block" ? "…" : "Block"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
