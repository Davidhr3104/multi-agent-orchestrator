"use client";

import { useEffect, useMemo, useState } from "react";
import type { InboxMessage } from "@/lib/types";
import { slaClock } from "@/lib/sla";
import { planShowing } from "@/lib/showing-schedule";
import { cn } from "@/lib/utils";

type Lane = "all" | "sla" | "conflict" | "review" | "draft" | "vip";

function channelOf(message: InboxMessage) {
  const text = `${message.subject} ${message.fromEmail}`;
  if (/whatsapp/i.test(text)) return { code: "WA", className: "border-sky-500/30 bg-sky-500/10 text-sky-300" };
  if (/\bsms\b/i.test(text)) return { code: "SMS", className: "border-slate-500/40 bg-slate-500/10 text-slate-300" };
  return { code: "GM", className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" };
}

function formatRemain(seconds: number) {
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = Math.floor(abs % 60);
  const clock = h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return seconds < 0 ? `-${clock}` : clock;
}

export function DashboardPanorama({
  messages,
  selectedId,
  onSelect,
  onAsk,
  onDispatch,
  onSnooze,
  query = "",
}: {
  messages: InboxMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAsk: (text: string) => void;
  onDispatch: (id: string) => void;
  onSnooze: (id: string) => void;
  query?: string;
}) {
  const [lane, setLane] = useState<Lane>("all");
  const [prompt, setPrompt] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [modelLabel, setModelLabel] = useState("Claude");

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    void fetch("/api/studio")
      .then((response) => response.json())
      .then((data: { profile?: { model?: string } }) => {
        const known: Record<string, string> = {
          "claude-sonnet-4-20250514": "Claude Sonnet 4",
          "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet",
          "claude-3-5-haiku-latest": "Claude 3.5 Haiku",
        };
        if (data.profile?.model) setModelLabel(known[data.profile.model] ?? data.profile.model);
      })
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return messages
      .filter((message) => {
        if (!needle) return true;
        return (
          message.subject.toLowerCase().includes(needle) ||
          message.fromName.toLowerCase().includes(needle) ||
          message.fromEmail.toLowerCase().includes(needle)
        );
      })
      .map((message) => {
        const plan = planShowing({ fromName: message.fromName, subject: message.subject, body: message.body });
        const clock = now == null ? null : slaClock(message, now);
        const open = message.status === "open" || message.status === "review";
        return { message, plan, clock, open };
      })
      .sort((a, b) => {
        const aLeft = a.clock?.remainingSec ?? 9e9;
        const bLeft = b.clock?.remainingSec ?? 9e9;
        return aLeft - bLeft;
      });
  }, [messages, now, query]);

  const active = rows.filter((row) => row.open);
  const slaCritical = active.filter((row) => row.clock && row.clock.remainingSec <= 60 * 60);
  const conflicts = rows.filter((row) => row.plan?.status === "conflict");
  const review = rows.filter((row) => row.message.needsReview);
  const drafted = rows.filter((row) => row.message.draftReply.trim().length > 0);
  const vip = rows.filter((row) => row.message.leadIntent || row.message.isStarred);
  const avgConfidence = messages.length
    ? Math.round(messages.reduce((sum, message) => sum + message.aiConfidence, 0) / messages.length)
    : 0;
  const autoShare = messages.length ? Math.round((messages.filter((message) => !message.needsReview).length / messages.length) * 100) : 0;

  const visible = rows.filter((row) => {
    if (lane === "sla") return slaCritical.includes(row);
    if (lane === "conflict") return row.plan?.status === "conflict";
    if (lane === "review") return row.message.needsReview;
    if (lane === "draft") return row.message.draftReply.trim().length > 0;
    if (lane === "vip") return row.message.leadIntent || row.message.isStarred;
    return row.message.status !== "blocked";
  });

  function ask(text: string) {
    const next = text.trim();
    if (!next) return;
    onAsk(next);
    setPrompt("");
  }

  const presets = [
    "Resolve schedule conflicts",
    "Prioritize critical SLAs",
    "Batch-approve verified drafts",
    "Explain the travel buffer between visits",
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Active queue" value={String(active.length)} hint={`${slaCritical.length} under 1h SLA`} bar={Math.min(100, active.length * 12)} tone="violet" />
        <Metric label="Auto-intercept" value={`${autoShare}%`} hint="threads not waiting on a person" bar={autoShare} tone="indigo" />
        <Metric label="Open breaches" value={String(slaCritical.filter((row) => row.clock?.breached).length)} hint={`${conflicts.length} schedule conflicts`} bar={slaCritical.length ? 100 : 8} tone="sky" />
        <Metric label="Avg confidence" value={`${avgConfidence}%`} hint={modelLabel} bar={avgConfidence} tone="violet" />
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-[#121520] p-5 shadow-[0_4px_30px_rgba(139,92,246,0.12)]">
        <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-violet-300 uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-violet-300" />
              Helix cognitive core · {modelLabel}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Ask Helix Inbox AI</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">Triage, schedule collisions, SLA risk, and drafts. Nothing sends until you confirm.</p>
            <form
              className="mt-3 flex h-11 max-w-3xl items-center gap-2 rounded-xl border border-[#3b4261] bg-[#07090e] px-3"
              onSubmit={(event) => {
                event.preventDefault();
                ask(prompt);
              }}
            >
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="e.g. Reschedule Camila Soto to Friday 11:00, review SLA breaches, draft the visit reply"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-500"
              />
              <button type="submit" className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white">
                Ask Copilot
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((item) => (
                <button key={item} type="button" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200" onClick={() => ask(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-violet-400/25 bg-[#0b0e14] shadow-[0_0_24px_rgba(139,92,246,0.25)] sm:h-40 lg:h-36 lg:w-56">
            <img src="/ask-ai/helix-core.jpg" alt="Helix cognitive core" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-x-0 bottom-2 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-[#07090e]/90 px-2 py-0.5 font-mono text-[9px] font-semibold text-sky-300">
                <span className="size-1 animate-pulse rounded-full bg-sky-300" />
                {avgConfidence}% confidence
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <LaneButton active={lane === "all"} onClick={() => setLane("all")} label="All inbound" count={rows.filter((row) => row.message.status !== "blocked").length} />
        <LaneButton active={lane === "sla"} onClick={() => setLane("sla")} label="SLA critical" count={slaCritical.length} tone="red" />
        <LaneButton active={lane === "conflict"} onClick={() => setLane("conflict")} label="Schedule conflicts" count={conflicts.length} tone="indigo" />
        <LaneButton active={lane === "review"} onClick={() => setLane("review")} label="Needs human review" count={review.length} />
        <LaneButton active={lane === "draft"} onClick={() => setLane("draft")} label="Auto-drafted" count={drafted.length} />
        <LaneButton active={lane === "vip"} onClick={() => setLane("vip")} label="VIP" count={vip.length} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#272a38] bg-[#0e111a]">
        <div className="grid grid-cols-12 border-b border-[#272a38] bg-[#121520] px-4 py-2 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
          <div className="col-span-4">Sender</div>
          <div className="col-span-5">Subject and intent</div>
          <div className="col-span-1 text-center">Confidence</div>
          <div className="col-span-2 text-right">SLA</div>
        </div>
        <div className="divide-y divide-[#1e2230]">
          {visible.map(({ message, plan, clock }) => {
            const channel = channelOf(message);
            const critical = clock?.breached || (clock && clock.remainingSec <= 15 * 60);
            const warning = clock && !critical && clock.remainingSec <= 60 * 60;
            const intent = plan?.status === "conflict" ? plan.summary : plan?.status === "book" ? "Visit confirmed" : message.draftReply ? "Draft ready" : message.reasoning;
            return (
              <div
                key={message.id}
                className={cn("group relative grid cursor-pointer grid-cols-12 items-center px-4 py-3 hover:bg-[#151926]", selectedId === message.id && "bg-[#151926]")}
                onClick={() => onSelect(message.id)}
              >
                <span className={cn("absolute top-0 bottom-0 left-0 w-1", critical ? "bg-red-500" : warning ? "bg-indigo-500" : "bg-transparent")} />
                <div className="col-span-4 flex min-w-0 items-center gap-2 pr-3">
                  <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold", channel.className)}>{channel.code}</span>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-700 text-[11px] font-bold text-white">
                    {message.fromName
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">{message.fromName}</p>
                    <p className="truncate font-mono text-[10px] text-slate-400">{message.fromEmail}</p>
                  </div>
                </div>
                <div className="col-span-5 min-w-0 pr-3">
                  <p className="truncate text-[13px] text-slate-200">{message.subject}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-violet-200">{intent}</p>
                </div>
                <div className="col-span-1 text-center font-mono text-[11px] text-emerald-300">{Math.round(message.aiConfidence)}%</div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[11px] font-bold group-hover:hidden",
                      critical ? "bg-red-600 text-white" : warning ? "bg-indigo-800 text-indigo-100" : "border border-white/10 text-slate-400"
                    )}
                  >
                    {clock ? formatRemain(clock.remainingSec) : message.status}
                  </span>
                  <div className="hidden items-center gap-1 group-hover:flex">
                    <button type="button" className="rounded border border-white/10 bg-[#181b26] px-2 py-1 font-mono text-[10px] text-white" onClick={(event) => { event.stopPropagation(); onSelect(message.id); }}>
                      Peek
                    </button>
                    <button type="button" className="rounded bg-violet-600 px-2 py-1 font-mono text-[10px] font-bold text-white" onClick={(event) => { event.stopPropagation(); onDispatch(message.id); }}>
                      Dispatch
                    </button>
                    <button type="button" className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-300" onClick={(event) => { event.stopPropagation(); onSnooze(message.id); }}>
                      Snooze
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {visible.length === 0 ? <p className="px-4 py-8 text-sm text-slate-500">No threads in this lane.</p> : null}
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#07090e] px-4 py-3 font-mono text-[11px] text-slate-400">
        <span>
          Showing <span className="font-semibold text-white">{visible.length}</span> of {rows.filter((row) => row.message.status !== "blocked").length} prioritized
        </span>
        <span>J/K navigate · Peek opens the inspector · Dispatch approves the draft · Snooze parks the thread</span>
      </footer>
    </div>
  );
}

function Metric({ label, value, hint, bar, tone }: { label: string; value: string; hint: string; bar: number; tone: "violet" | "indigo" | "sky" }) {
  const barClass = tone === "sky" ? "bg-sky-400" : tone === "indigo" ? "bg-indigo-400" : "bg-violet-400";
  return (
    <div className="rounded-xl border border-white/10 bg-[#121520] p-3.5">
      <p className="font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{hint}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", barClass)} style={{ width: `${Math.max(4, Math.min(100, bar))}%` }} />
      </div>
    </div>
  );
}

function LaneButton({ active, label, count, onClick, tone }: { active: boolean; label: string; count: number; onClick: () => void; tone?: "red" | "indigo" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[12px]",
        active && "border-violet-400/50 bg-violet-600/20 text-violet-200",
        !active && tone === "red" && "border-red-500/40 bg-red-950/40 text-red-200",
        !active && tone === "indigo" && "border-indigo-500/30 bg-[#181a28] text-indigo-100",
        !active && !tone && "border-white/10 bg-[#121520] text-slate-300"
      )}
    >
      {label}
      <span className="rounded-full bg-black/30 px-1.5 text-[10px]">{count}</span>
    </button>
  );
}
