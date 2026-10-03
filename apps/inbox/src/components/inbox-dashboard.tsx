"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Search, Zap } from "lucide-react";
import { AiToast, DemoBanner, useAiDeskEvents } from "@/components/ai-desk-events";
import type { InboxMessage, ThreadMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EducationalEmpty } from "@/components/educational-empty";
import { INBOX_HELP, EMPTY_INBOX } from "@helix/help";
import { summarizeInboxSla } from "@/lib/sla";
import { rememberFocus } from "@/lib/desk-ui";
import { toneHint } from "@/lib/tone";
import { readKnowledgeLinks } from "@/lib/knowledge-links";
import type { InboxPersona } from "@/lib/agent-profile";
import { SlaCountdown } from "@/components/sla-countdown";
import { DraftDiff } from "@/components/draft-diff";
import { DashboardPanorama } from "@/components/dashboard-panorama";
import { ActiveInspector } from "@/components/active-inspector";
import Link from "next/link";

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

  useEffect(() => {
    rememberFocus(selectedId);
  }, [selectedId]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const savedFilter = localStorage.getItem("helix-inbox-filter");
    const savedQuery = localStorage.getItem("helix-inbox-query");
    if (savedFilter === "all" || savedFilter === "urgent" || savedFilter === "review" || savedFilter === "routed" || savedFilter === "blocked") {
      setFilter(savedFilter);
    }
    if (savedQuery) setQuery(savedQuery);
    function onQuery(e: Event) {
      setQuery((e as CustomEvent<string>).detail ?? "");
    }
    function onFocus(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id) setSelectedId(id);
    }
    window.addEventListener("helix:set-query", onQuery);
    window.addEventListener("helix:focus-thread", onFocus);
    return () => {
      window.removeEventListener("helix:set-query", onQuery);
      window.removeEventListener("helix:focus-thread", onFocus);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("helix-inbox-filter", filter);
    localStorage.setItem("helix-inbox-query", query);
  }, [filter, query]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"memory" | "supabase">("memory");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([]);
  const [vipSenders, setVipSenders] = useState<string[]>([]);
  const [form, setForm] = useState({
    fromName: "",
    fromEmail: "",
    subject: "",
    body: "",
  });
  const [ingestOpen, setIngestOpen] = useState(false);
  const [persona, setPersona] = useState<InboxPersona>("executive");

  useEffect(() => {
    if (sessionStorage.getItem("helix-inbox-ingest-open") === "1") setIngestOpen(true);
    void fetch("/api/studio")
      .then((r) => r.json())
      .then((d: { profile?: { persona?: InboxPersona } }) => {
        if (d.profile?.persona) setPersona(d.profile.persona);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("helix-inbox-ingest-open", ingestOpen ? "1" : "0");
  }, [ingestOpen]);

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

  const { toast: aiToast } = useAiDeskEvents(refresh);

  useEffect(() => {
    setFilter(filterFromHash());
    void refresh();
    void fetch("/api/preferences")
      .then((r) => r.json())
      .then((d: { preferences?: { templates?: { id: string; name: string; body: string }[]; vipSenders?: string[] } }) => {
        setTemplates(d.preferences?.templates ?? []);
        setVipSenders(d.preferences?.vipSenders ?? []);
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

  const sla = useMemo(() => summarizeInboxSla(messages), [messages]);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (filter === "urgent" && !(m.priority === "urgent" || m.sentiment === "urgent")) return false;
      if (filter === "review" && !m.needsReview) return false;
      if (filter === "routed" && m.status !== "routed" && m.status !== "sent") return false;
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

  async function syncGmail() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/sync", { method: "POST" });
      const data = (await res.json()) as { imported?: number; scanned?: number; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      flash(`Gmail sync · ${data.imported ?? 0} new of ${data.scanned ?? 0}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(
    id: string,
    action: "approve" | "route" | "block" | "snooze" | "smart_reply" | "star" | "meeting" | "attach_kb" | "crm" | "save_style",
    extra?: Record<string, string | string[]>
  ) {
    setActionBusy(action);
    setError(null);
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = (await res.json()) as { message?: InboxMessage; error?: string };
    setActionBusy(null);
    if (!res.ok) {
      setError(data.error || `Action failed (${res.status})`);
      return;
    }
    flash(
      action === "approve"
        ? "Reply sent"
        : action === "route"
          ? "Marked routed (not sent)"
          : action === "block"
            ? "Blocked"
            : action === "snooze"
              ? "Snoozed"
              : action === "star"
                ? data.message?.isStarred
                  ? "Starred"
                  : "Unstarred"
                : action === "meeting"
                  ? "Meeting link added"
                  : action === "attach_kb"
                    ? "Company source attached"
                    : action === "crm"
                      ? "HubSpot deal created"
                      : action === "save_style"
                        ? "Style saved"
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
    <main className="min-w-0 bg-[#0b0e14] px-3 py-4 text-slate-100 sm:px-4 md:px-6 md:py-5">
      {toast ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg border border-violet-400/30 bg-[#121520] px-4 py-2 text-xs font-medium text-violet-100 shadow-xl">
          {toast}
        </div>
      ) : null}
      <div className="mx-auto mb-4 flex max-w-[1600px] items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Inbox command center</h1>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
            <span className="hidden sm:inline">Priority stream · </span>Desk data · {persistence}{loading ? " · loading" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled={loading} onClick={() => void refresh()} className="min-h-10 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 md:min-h-8">
            Refresh
          </button>
          <button type="button" onClick={() => setIngestOpen((open) => !open)} className="min-h-10 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white md:min-h-8">
            New thread
          </button>
        </div>
      </div>
      {error ? <p className="mx-auto mb-3 max-w-[1600px] text-sm text-red-300">{error}</p> : null}
      <DemoBanner message="You are exploring sample email. Connect Gmail and this desk switches to your real mail — the samples disappear." connectHref="/settings" connectLabel="Connect Gmail →" />
      <AiToast message={aiToast} />
      {ingestOpen ? (
        <form
          className="mx-auto mb-4 grid max-w-[1600px] gap-2 rounded-xl border border-white/10 bg-[#121520] p-3 md:grid-cols-2"
          onSubmit={(event) => void ingest(event)}
        >
          <input id="ingest-from-name" value={form.fromName} onChange={(event) => setForm((f) => ({ ...f, fromName: event.target.value }))} placeholder="From name" className="rounded-lg border border-white/10 bg-[#07090e] px-3 py-2 text-sm" />
          <input value={form.fromEmail} onChange={(event) => setForm((f) => ({ ...f, fromEmail: event.target.value }))} placeholder="Email" className="rounded-lg border border-white/10 bg-[#07090e] px-3 py-2 text-sm" />
          <input value={form.subject} onChange={(event) => setForm((f) => ({ ...f, subject: event.target.value }))} placeholder="Subject" className="rounded-lg border border-white/10 bg-[#07090e] px-3 py-2 text-sm md:col-span-2" />
          <textarea value={form.body} onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))} placeholder="Body" className="min-h-20 rounded-lg border border-white/10 bg-[#07090e] px-3 py-2 text-sm md:col-span-2" />
          <button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white md:col-span-2">
            {busy ? "Ingesting…" : "Ingest"}
          </button>
        </form>
      ) : null}
      <DashboardPanorama
        messages={messages}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAsk={(text) => window.dispatchEvent(new CustomEvent("helix:ask", { detail: text }))}
        onDispatch={(id) => void act(id, "approve")}
        onSnooze={(id) => void act(id, "snooze")}
        query={query}
        vipSenders={vipSenders}
      />
      {selected ? (
        <div className="mx-auto mt-4 max-w-[1600px]">
          <ActiveInspector thread={selected} onUpdate={() => void refresh()} />
        </div>
      ) : null}
    </main>
  );
}
