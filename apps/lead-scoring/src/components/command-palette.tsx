"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoredLead } from "@helix/core";

type Item = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

function exportCsv(rows: StoredLead[]) {
  const header = ["name", "email", "source", "score", "tier"];
  const body = rows
    .map((l) => [l.name, l.email, l.source, l.score, l.tier].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`${header.join(",")}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "helix-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    inputRef.current?.focus();
    void fetch("/api/leads")
      .then((r) => r.json())
      .then((d: { leads?: StoredLead[] }) => setLeads(d.leads ?? []));
  }, [open]);

  const items = useMemo(() => {
    const actions: Item[] = [
      { id: "new", label: "Create new lead", hint: "N", run: () => { router.push("/"); onClose(); window.dispatchEvent(new Event("helix:new-lead")); } },
      { id: "csv", label: "Export CSV", hint: "Action", run: () => { exportCsv(leads); onClose(); } },
      { id: "dash", label: "Go to Dashboard", hint: "Page", run: () => { router.push("/"); onClose(); } },
      { id: "leads", label: "Go to Leads", hint: "Page", run: () => { router.push("/leads"); onClose(); } },
      { id: "analytics", label: "Go to Analytics", hint: "Page", run: () => { router.push("/analytics"); onClose(); } },
      { id: "inbox", label: "Go to Inbox", hint: "Page", run: () => { router.push("/inbox"); onClose(); } },
      { id: "usage", label: "Go to Usage & API", hint: "Page", run: () => { router.push("/settings/usage"); onClose(); } },
      { id: "prompts", label: "Go to Prompt Playground", hint: "Page", run: () => { router.push("/settings/prompts"); onClose(); } },
      { id: "scoring", label: "Go to Scoring Rules", hint: "Settings", run: () => { router.push("/settings/scoring"); onClose(); } },
      { id: "brand", label: "Go to White-label", hint: "Settings", run: () => { router.push("/settings/brand"); onClose(); } },
      { id: "audit", label: "Go to Audit Log", hint: "Page", run: () => { router.push("/audit"); onClose(); } },
    ];
    const leadItems: Item[] = leads.map((l) => ({
      id: `lead-${l.id}`,
      label: `${l.name} · ${l.email}`,
      hint: `${l.score} ${l.tier}`,
      run: () => {
        router.push("/");
        onClose();
        window.dispatchEvent(new CustomEvent("helix:open-lead", { detail: l.id }));
      },
    }));
    const all = [...actions, ...leadItems];
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 12);
    return all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(needle)).slice(0, 16);
  }, [leads, q, onClose, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[15vh]">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="card-bg relative z-10 w-full max-w-lg overflow-hidden rounded-xl">
        <input
          ref={inputRef}
          className="h-11 w-full border-b border-sky-900/50 bg-transparent px-4 text-sm text-slate-200 outline-none"
          placeholder="Search leads, pages, actions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && items[0]) items[0].run();
          }}
        />
        <ul className="max-h-80 overflow-auto py-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5"
                onClick={item.run}
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-slate-500">{item.hint}</span>
              </button>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">No matches.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const rows = [
    ["⌘ / Ctrl + K", "Command palette"],
    ["N", "New lead"],
    ["/", "Focus search"],
    ["Esc", "Close panels"],
    ["?", "This cheat sheet"],
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="card-bg relative z-10 w-full max-w-sm rounded-xl p-5">
        <p className="mb-3 text-sm font-semibold text-white">Keyboard shortcuts</p>
        <ul className="space-y-2 text-sm text-slate-300">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-4">
              <span className="font-mono text-xs text-sky-400">{k}</span>
              <span className="text-slate-400">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
