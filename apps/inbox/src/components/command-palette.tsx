"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readFocus } from "@/lib/desk-ui";
import { downloadCsv } from "@/lib/download";
import type { InboxMessage } from "@/lib/types";

const QUERY_KEY = "helix-inbox-palette";

type Row = { id: string; label: string; hint: string; run: () => void | Promise<void> };

export function CommandPalette({
  open,
  onClose,
  onToggleDense,
}: {
  open: boolean;
  onClose: () => void;
  onToggleDense: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [threads, setThreads] = useState<InboxMessage[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery(sessionStorage.getItem(QUERY_KEY) ?? "");
    setStatus(null);
    void fetch("/api/messages")
      .then((r) => r.json())
      .then((d: { messages?: InboxMessage[] }) => setThreads(d.messages ?? []))
      .catch(() => setThreads([]));
  }, [open]);

  useEffect(() => {
    if (open) sessionStorage.setItem(QUERY_KEY, query);
  }, [open, query]);

  function go(href: string) {
    router.push(href);
    onClose();
  }

  async function act(action: "approve" | "snooze" | "route") {
    const id = readFocus();
    if (!id) {
      setStatus("Select an email first.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Action failed");
      return;
    }
    window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
    setStatus(action === "approve" ? "Approved and sent." : action === "snooze" ? "Snoozed." : "Routed.");
  }

  async function exportReport() {
    setBusy(true);
    const res = await fetch("/api/weekly-report");
    const data = (await res.json()) as { report?: Record<string, unknown> };
    setBusy(false);
    const report = data.report ?? {};
    downloadCsv(
      "helix-inbox-weekly.csv",
      Object.entries(report)
        .filter(([, value]) => typeof value !== "object")
        .map(([key, value]) => ({ metric: key, value: String(value ?? "") }))
    );
    setStatus("Weekly report downloaded.");
  }

  async function changeModel() {
    setBusy(true);
    const res = await fetch("/api/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycle: true }),
    });
    const data = (await res.json()) as { profile?: { model?: string } };
    setBusy(false);
    setStatus(data.profile?.model ? `Model: ${data.profile.model}` : "Could not change model");
    window.dispatchEvent(new CustomEvent("helix:model-changed"));
  }

  const q = query.trim().toLowerCase();
  const commands: Row[] = [
    { id: "approve", label: "Approve & send", hint: "Focused email", run: () => act("approve") },
    { id: "snooze", label: "Snooze", hint: "Focused email", run: () => act("snooze") },
    { id: "assign", label: "Assign / route", hint: "Focused email", run: () => act("route") },
    { id: "sla", label: "Go to SLA", hint: "Navigate", run: () => go("/sla") },
    { id: "model", label: "Change model", hint: "Agent", run: () => changeModel() },
    { id: "export", label: "Export report", hint: "CSV", run: () => exportReport() },
    { id: "dense", label: "Toggle dense mode", hint: "Layout", run: () => onToggleDense() },
    { id: "dash", label: "Go to dashboard", hint: "Navigate", run: () => go("/") },
    { id: "hitl", label: "Go to HITL queue", hint: "Navigate", run: () => go("/hitl-queue") },
    { id: "follow", label: "Go to followups", hint: "Navigate", run: () => go("/followup-queue") },
    { id: "routed", label: "Go to routed", hint: "Navigate", run: () => go("/routed") },
    { id: "analytics", label: "Go to analytics", hint: "Navigate", run: () => go("/analytics") },
    { id: "weekly", label: "Go to weekly report", hint: "Navigate", run: () => go("/weekly-report") },
    { id: "audit", label: "Go to audit log", hint: "Navigate", run: () => go("/audit") },
    { id: "studio", label: "Go to agent studio", hint: "Navigate", run: () => go("/studio") },
    { id: "integrations", label: "Go to integrations", hint: "Navigate", run: () => go("/integrations") },
    { id: "team", label: "Go to team", hint: "Navigate", run: () => go("/team") },
    { id: "settings", label: "Go to settings", hint: "Navigate", run: () => go("/settings") },
    {
      id: "search",
      label: q ? `Filter inbox: ${query.trim()}` : "Filter inbox",
      hint: "Search",
      run: () => {
        window.dispatchEvent(new CustomEvent("helix:set-query", { detail: query.trim() }));
        go("/");
      },
    },
  ];

  const shown = commands.filter((c) => !q || c.label.toLowerCase().includes(q));
  const hits = q
    ? threads
        .filter((t) => `${t.subject} ${t.fromName} ${t.fromEmail}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 px-4 pt-[14vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail, or run Go to SLA, Change model, Export report…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && shown[0] && !busy) void shown[0].run();
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {hits.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-surface-muted"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("helix:focus-thread", { detail: thread.id }));
                  go("/");
                }}
              >
                <span className="truncate font-medium text-foreground">{thread.subject}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{thread.fromName}</span>
              </button>
            </li>
          ))}
          {shown.map((cmd) => (
            <li key={cmd.id}>
              <button
                type="button"
                disabled={busy}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
                onClick={() => void cmd.run()}
              >
                <span className="font-medium text-foreground">{cmd.label}</span>
                <span className="text-[11px] text-muted-foreground">{cmd.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        {status ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{status}</p> : null}
      </div>
    </div>
  );
}
