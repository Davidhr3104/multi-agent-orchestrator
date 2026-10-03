"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { DemoChip, Donut, Sparkline } from "@helix/ui";
import type { InboxMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";
import { slaClock } from "@/lib/sla";
import { CATEGORY_COLOR, STATUS_COLOR, dailyVolume, deskCounts, statusLabel } from "@/lib/desk-metrics";
import { useDeskMode, useNow, useTzOffset } from "@/components/desk-kit";
import { cn } from "@/lib/utils";

type Lane = "all" | "sla" | "meeting" | "review" | "draft" | "vip";

const RECENT_MS = 48 * 3_600_000;

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
  vipSenders = [],
}: {
  messages: InboxMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAsk: (text: string) => void;
  onDispatch: (id: string) => void;
  onSnooze: (id: string) => void;
  query?: string;
  vipSenders?: string[];
}) {
  const [lane, setLane] = useState<Lane>("all");
  const [prompt, setPrompt] = useState("");
  const now = useNow();
  const [modelLabel, setModelLabel] = useState("Claude");
  const demo = useDeskMode() === "demo";
  const tz = useTzOffset();

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

  // Same numbers as Analytics, SLA and the weekly report: they all come from deskCounts().
  const counts = useMemo(() => deskCounts(messages, { vipSenders, now: now ?? 0 }), [messages, vipSenders, now]);
  const daily = useMemo(() => dailyVolume(messages, 14, now ?? 0, tz), [messages, now, tz]);

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
        const clock = now == null ? null : slaClock(message, now, vipSenders);
        const open = message.status === "open" || message.status === "review";
        return { message, clock, open };
      })
      .sort((a, b) => {
        const aLeft = a.clock?.remainingSec ?? 9e9;
        const bLeft = b.clock?.remainingSec ?? 9e9;
        return aLeft - bLeft;
      });
  }, [messages, now, query, vipSenders]);

  const recent = (m: InboxMessage) => now != null && now - Date.parse(m.receivedAt) <= RECENT_MS;
  const inAll = (row: (typeof rows)[number]) => row.message.status !== "blocked" && (row.open || recent(row.message));
  const breached = rows.filter((row) => row.open && row.clock?.breached);
  const meetings = rows.filter((row) => row.open && row.message.category === "meeting");
  const review = rows.filter((row) => row.message.needsReview);
  const drafted = rows.filter((row) => row.open && row.message.draftReply.trim().length > 0);
  const vip = rows.filter((row) => row.message.leadIntent || row.message.isStarred);
  const autoShare = counts.total ? 100 - counts.hitlRate : 0;

  const visible = rows.filter((row) => {
    if (lane === "sla") return breached.includes(row);
    if (lane === "meeting") return meetings.includes(row);
    if (lane === "review") return row.message.needsReview;
    if (lane === "draft") return drafted.includes(row);
    if (lane === "vip") return row.message.leadIntent || row.message.isStarred;
    return inAll(row);
  });
  const allCount = rows.filter(inAll).length;

  const statusSlices = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) map.set(m.status, (map.get(m.status) ?? 0) + 1);
    return [...map.entries()].map(([status, value]) => ({ label: statusLabel(status as InboxMessage["status"]), value, color: STATUS_COLOR[status as InboxMessage["status"]] }));
  }, [messages]);

  function ask(text: string) {
    const next = text.trim();
    if (!next) return;
    onAsk(next);
    setPrompt("");
  }

  const presets = [
    "Prioritize critical SLAs",
    "Draft replies for the review queue",
    "Batch-approve verified drafts",
    "Which meetings need an answer today?",
  ];

  const chip = demo ? <DemoChip /> : null;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4">
      <section aria-label="Key numbers" className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <Metric label="Active queue" value={String(counts.openCount)} hint={`${counts.atRiskCount} at risk · ${counts.breachCount} past SLA`} bar={Math.min(100, counts.openCount * 12)} tone="violet" spark={daily.map((d) => d.total)} sparkLabel="Threads received per day, last 14 days" chip={chip} />
          <Metric label="Auto-intercept" value={`${autoShare}%`} hint="threads not waiting on a person" bar={autoShare} tone="indigo" spark={daily.map((d) => (d.total ? Math.round((d.auto / d.total) * 100) : 0))} sparkLabel="Share handled automatically per day" chip={chip} />
          <Metric label="Open breaches" value={String(counts.breachCount)} hint={`${daily[daily.length - 1]?.urgent ?? 0} urgent arrivals today`} bar={counts.breachCount ? 100 : 8} tone="sky" spark={daily.map((d) => d.urgent)} sparkLabel="Urgent threads arriving per day" chip={chip} />
          <Metric label="Avg confidence" value={`${counts.avgConfidence}%`} hint={modelLabel} bar={counts.avgConfidence} tone="violet" spark={daily.map((d) => d.confidence)} sparkLabel="Average AI confidence per day" chip={chip} />
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-violet-400/20 bg-[#121520] p-4 text-slate-200">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Where threads stand</p>
            {chip}
          </div>
          <Donut slices={statusSlices} size={120} thickness={20} centerValue={messages.length} centerLabel="threads" ariaLabel="Threads by status" />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-[#121520] p-4 shadow-[0_4px_30px_rgba(139,92,246,0.12)] sm:p-5">
        <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-violet-300 uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-violet-300" />
              Helix cognitive core · {modelLabel}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">Ask Helix Inbox AI</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">Triage, SLA risk and drafts. Nothing sends until you confirm.</p>
            <form
              className="mt-3 flex min-h-11 max-w-3xl items-center gap-2 rounded-xl border border-[#3b4261] bg-[#07090e] px-3"
              onSubmit={(event) => {
                event.preventDefault();
                ask(prompt);
              }}
            >
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                aria-label="Ask Helix Inbox AI"
                placeholder="e.g. Draft a reply to Maya Chen, or review SLA breaches"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-500"
              />
              <button type="submit" className="min-h-9 shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white">
                Ask Copilot
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((item) => (
                <button key={item} type="button" className="min-h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 sm:min-h-0" onClick={() => ask(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("helix:ask", { detail: "" }))}
            aria-label="Open Ask Helix AI assistant"
            className="group relative hidden shrink-0 rounded-xl transition-transform hover:scale-[1.02] lg:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ask-ai/ask-ai-visual.png" alt="" className="h-44 w-auto rounded-xl object-contain" />
            <span className="absolute right-2 bottom-2 left-2 flex items-center justify-center gap-1 rounded-md bg-black/70 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-black/85">
              Ask Helix <span aria-hidden>→</span>
            </span>
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter threads">
        <LaneButton active={lane === "all"} onClick={() => setLane("all")} label="All inbound" count={allCount} />
        <LaneButton active={lane === "sla"} onClick={() => setLane("sla")} label="SLA breached" count={breached.length} tone="red" />
        <LaneButton active={lane === "meeting"} onClick={() => setLane("meeting")} label="Meetings" count={meetings.length} tone="indigo" />
        <LaneButton active={lane === "review"} onClick={() => setLane("review")} label="Needs human review" count={review.length} />
        <LaneButton active={lane === "draft"} onClick={() => setLane("draft")} label="Auto-drafted" count={drafted.length} />
        <LaneButton active={lane === "vip"} onClick={() => setLane("vip")} label="VIP" count={vip.length} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[#272a38] bg-[#0e111a]">
        <div className="hidden grid-cols-12 border-b border-[#272a38] bg-[#121520] px-4 py-2 font-mono text-[10px] tracking-wider text-slate-500 uppercase sm:grid">
          <div className="col-span-4">Sender</div>
          <div className="col-span-5">Subject and intent</div>
          <div className="col-span-1 text-center">Confidence</div>
          <div className="col-span-2 text-right">SLA</div>
        </div>
        <div className="divide-y divide-[#1e2230]">
          {visible.map(({ message, clock }) => {
            const critical = clock?.breached || (clock && clock.remainingSec <= 15 * 60);
            const warning = clock && !critical && clock.remainingSec <= 60 * 60;
            const intent = message.draftReply ? "Draft ready" : message.reasoning;
            const select = () => onSelect(message.id);
            return (
              <div
                key={message.id}
                data-ai-id={message.id}
                role="button"
                tabIndex={0}
                onClick={select}
                onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select();
                  }
                }}
                className={cn("group relative grid min-w-0 cursor-pointer grid-cols-1 items-center gap-1 px-4 py-3 hover:bg-[#151926] sm:grid-cols-12 sm:gap-0", selectedId === message.id && "bg-[#151926]")}
              >
                <span className={cn("absolute top-0 bottom-0 left-0 w-1", critical ? "bg-red-500" : warning ? "bg-indigo-500" : "bg-transparent")} />
                <div className="flex min-w-0 items-center gap-2 pr-3 sm:col-span-4">
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ borderColor: `${CATEGORY_COLOR[message.category]}55`, background: `${CATEGORY_COLOR[message.category]}1a`, color: CATEGORY_COLOR[message.category] }} title={categoryLabel(message.category)}>
                    {message.category === "action_required" ? "ACT" : message.category === "meeting" ? "MTG" : message.category === "fyi" ? "FYI" : "SPM"}
                  </span>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-700 text-[11px] font-bold text-white" aria-hidden>
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
                <div className="min-w-0 pr-3 sm:col-span-5">
                  <p className="truncate text-[13px] text-slate-200">{message.subject}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-violet-200">{intent}</p>
                </div>
                <div className="flex items-center gap-3 sm:contents">
                  <div className="font-mono text-[11px] text-emerald-300 sm:col-span-1 sm:text-center">
                    <span className="mr-1 text-slate-500 sm:hidden">Confidence</span>
                    {Math.round(message.aiConfidence)}%
                  </div>
                  <div className="ml-auto flex items-center justify-end gap-1.5 sm:col-span-2">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[11px] font-bold sm:group-hover:hidden",
                        critical ? "bg-red-600 text-white" : warning ? "bg-indigo-800 text-indigo-100" : "border border-white/10 text-slate-400"
                      )}
                    >
                      {clock ? formatRemain(clock.remainingSec) : statusLabel(message.status)}
                    </span>
                    <div className="hidden items-center gap-1 sm:group-hover:flex sm:group-focus-within:flex">
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
              </div>
            );
          })}
          {visible.length === 0 ? <p className="px-4 py-8 text-sm text-slate-500">No threads in this lane.</p> : null}
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#07090e] px-4 py-3 font-mono text-[11px] text-slate-400">
        <span>
          Showing <span className="font-semibold text-white">{visible.length}</span> of {allCount} active or recent
        </span>
        <span className="hidden sm:inline">J/K navigate · Peek opens the inspector · Dispatch approves the draft · Snooze parks the thread</span>
      </footer>
    </div>
  );
}

function Metric({ label, value, hint, bar, tone, spark, sparkLabel, chip }: { label: string; value: string; hint: string; bar: number; tone: "violet" | "indigo" | "sky"; spark: number[]; sparkLabel: string; chip: React.ReactNode }) {
  const barClass = tone === "sky" ? "bg-sky-400" : tone === "indigo" ? "bg-indigo-400" : "bg-violet-400";
  const color = tone === "sky" ? "#38bdf8" : tone === "indigo" ? "#818cf8" : "#a78bfa";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#121520] p-3.5 text-slate-200">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
        {chip}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-mono text-2xl font-bold text-white">{value}</p>
        <Sparkline values={spark} color={color} label={sparkLabel} width={72} height={26} />
      </div>
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
      aria-pressed={active}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[12px] md:min-h-0",
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
