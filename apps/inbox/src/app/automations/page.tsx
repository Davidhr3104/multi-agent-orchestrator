"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, CheckCircle2, CircleAlert, Clock, Inbox, Loader2, MessageCircle, Pause, Play, ScrollText, Send, Hash, Sparkles, Trash2, Workflow } from "lucide-react";
import type { AutomationRun, AutomationSpec, Requirement } from "@helix/core/automations";
import { DemoChip, FlowCanvas, type FlowNode } from "@helix/ui";
import { PageFrame } from "@/components/desk-kit";
import { CHANNEL_LABEL, channelInfos } from "@/lib/automations/catalog";
import { specToGraph, type IconKey } from "@/lib/automations/graph";
import { describeSchedule } from "@/lib/automations/service";
import type { BuiltinInfo } from "@/lib/automations/builtins";

type Snapshot = {
  mode: "demo" | "live";
  limit: number;
  timezone: string | null;
  automations: AutomationSpec[];
  runs: AutomationRun[];
  sources: { id: string; label: string; description: string; includes: string[] }[];
  connections: { slack: boolean; twilio: boolean; gmail: boolean };
  cronConfigured: boolean;
  builtins: BuiltinInfo[];
  reply?: string;
  run?: AutomationRun;
  error?: string;
};

const btn = "inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 md:min-h-9";
const btnPrimary = "inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 md:min-h-9";
const field = "min-h-10 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm md:min-h-9";

const EXAMPLE = "Send me a summary of my inbox every day at 9pm on Slack";

function detectTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function statusChip(status: AutomationSpec["status"]) {
  const tone = status === "active" ? "bg-emerald-500/15 text-emerald-500" : status === "paused" ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-500";
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Draft";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function runChip(run: AutomationRun) {
  const tone = run.status === "ok" ? "text-emerald-500" : run.status === "failed" ? "text-red-500" : "text-amber-500";
  const label = run.status === "ok" ? (run.preview ? "Preview ok" : "Sent") : run.status === "failed" ? "Failed" : run.status === "expired" ? "Missed" : "Skipped";
  return <span className={`text-xs font-semibold ${tone}`}>{label}</span>;
}

const ICONS: Record<IconKey, ReactNode> = {
  clock: <Clock className="size-4" />,
  inbox: <Inbox className="size-4" />,
  slack: <Hash className="size-4" />,
  phone: <MessageCircle className="size-4" />,
  app: <Bell className="size-4" />,
  history: <ScrollText className="size-4" />,
};

/** The routine drawn as a workflow canvas: trigger → data → send → record, each card showing its real state. */
function AutomationCanvas({ spec, conn, run }: { spec: AutomationSpec; conn: Snapshot["connections"]; run?: AutomationRun }) {
  const graph = specToGraph(spec, channelInfos({ slack: conn.slack, twilio: conn.twilio }), run);
  const nodes: FlowNode[] = graph.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    subtitle: n.subtitle,
    icon: ICONS[n.iconKey],
    tone: n.tone,
    chips: n.chips,
    action: n.action ? (
      <a href={n.action.href} className="underline underline-offset-2" style={{ color: "#8b8bf5" }}>
        {n.action.label}
      </a>
    ) : undefined,
  }));
  return <FlowCanvas nodes={nodes} edges={graph.edges} ariaLabel={`Flow of ${spec.name}`} />;
}

function RequirementRow({
  spec,
  req,
  detectedTz,
  busy,
  onAct,
}: {
  spec: AutomationSpec;
  req: Requirement;
  detectedTz: string | null;
  busy: boolean;
  onAct: (body: Record<string, unknown>) => void;
}) {
  const [phone, setPhone] = useState("");
  if (req.kind === "connection") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-foreground">Connect {req.label}</span>
        <a href={req.connectUrl} className={btnPrimary}>
          Connect
        </a>
      </li>
    );
  }
  if (req.kind === "setting") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-foreground">Set your time zone</span>
        {detectedTz ? (
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => onAct({ action: "timezone", timezone: detectedTz })}>
            Use {detectedTz}
          </button>
        ) : (
          <a href="#settings" className={btn}>
            Set it
          </a>
        )}
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <label className="text-xs text-foreground" htmlFor={`phone-${spec.id}`}>
        Add your {req.label}
      </label>
      <span className="flex items-center gap-2">
        <input id={`phone-${spec.id}`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5215512345678" inputMode="tel" className={`${field} w-44!`} />
        <button type="button" className={btnPrimary} disabled={busy || !phone.trim()} onClick={() => onAct({ action: "recipient", id: spec.id, to: phone })}>
          Save
        </button>
      </span>
    </li>
  );
}

export default function AutomationsPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
  const detectedTz = useMemo(() => detectTimeZone(), []);

  const [source, setSource] = useState("inbox.daily_digest");
  const [time, setTime] = useState("21:00");
  const [channel, setChannel] = useState("in_app");
  const [to, setTo] = useState("");
  const [tzInput, setTzInput] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/automations");
      const data = (await res.json()) as Snapshot;
      if (!res.ok) throw new Error(data.error ?? "Could not load automations");
      setSnap(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load automations");
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("helix:desk-refresh", onRefresh);
    return () => window.removeEventListener("helix:desk-refresh", onRefresh);
  }, [load]);

  useEffect(() => {
    if (!snap || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [snap?.automations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as Snapshot;
      if (!res.ok) throw new Error(data.error ?? "That did not work");
      setSnap(data);
      if (data.reply) setNotice(data.reply.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"));
      if (data.run) setLastRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  const phoneChannel = channel === "whatsapp" || channel === "sms";
  const nameOf = (id: string) => snap?.automations.find((a) => a.id === id)?.name ?? id;

  return (
    <PageFrame
      title="Automations"
      subtitle="Routines Helix runs for you, built only from the tools this desk is connected to. Ask Helix in plain language, or build one below."
      chips={snap?.mode === "demo" ? <DemoChip kind="demo" /> : null}
      actions={
        <button type="button" className={btnPrimary} onClick={() => window.dispatchEvent(new CustomEvent("helix:ask", { detail: EXAMPLE }))}>
          <Sparkles className="size-3.5" aria-hidden /> Ask Helix to create one
        </button>
      }
    >
      <div role="alert" aria-live="polite">
        {error ? <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}
        {notice ? <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm whitespace-pre-line text-foreground">{notice}</p> : null}
      </div>

      {!snap && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading automations…
        </p>
      ) : null}

      {snap?.mode === "demo" ? (
        <p className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          Demo desk: your routines are kept in this browser and nothing is really sent. Connect Gmail and Slack or Twilio to run them for real.
        </p>
      ) : null}
      {snap && snap.mode === "live" && !snap.cronConfigured ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          CRON_SECRET is not set, so scheduled runs are off. You can still use Send now on a routine.
        </p>
      ) : null}

      {snap ? (
        <>
          <section id="settings" className="glass-panel rounded-xl p-4" aria-labelledby="tz-h">
            <h2 id="tz-h" className="text-sm font-semibold">
              Time zone
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Schedules like “every day at 9pm” run in this time zone.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {snap.timezone ? <span className="text-sm font-medium">{snap.timezone}</span> : <span className="text-sm text-amber-500">Not set</span>}
              {detectedTz && detectedTz !== snap.timezone ? (
                <button type="button" className={btn} disabled={busy} onClick={() => void act({ action: "timezone", timezone: detectedTz })}>
                  Use {detectedTz}
                </button>
              ) : null}
              <input value={tzInput} onChange={(e) => setTzInput(e.target.value)} placeholder="America/Mexico_City" aria-label="Time zone name" className={`${field} w-56!`} />
              <button type="button" className={btn} disabled={busy || !tzInput.trim()} onClick={() => void act({ action: "timezone", timezone: tzInput.trim() })}>
                Save
              </button>
            </div>
          </section>

          <section aria-labelledby="builtin-h" className="space-y-2">
            <h2 id="builtin-h" className="text-sm font-semibold">
              Included in this Helix
            </h2>
            <p className="text-xs text-muted-foreground">These run from the deployment&apos;s scheduler. “Configured” means the settings they need are present, not that the last run succeeded.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {snap.builtins.map((b) => (
                <article key={b.id} className="glass-panel rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{b.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.ready ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{b.ready ? "Configured" : "Needs setup"}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{b.what}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> {b.schedule}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {b.needs.map((n) => (
                      <li key={n.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5">
                          {n.ok ? <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden /> : <CircleAlert className="size-3.5 text-amber-500" aria-hidden />}
                          {n.label}
                        </span>
                        {n.ok ? null : (
                          <a href={n.fixUrl} className="font-semibold text-accent underline underline-offset-2">
                            Set up
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="mine-h" className="space-y-2">
            <h2 id="mine-h" className="text-sm font-semibold">
              Yours
            </h2>
            {snap.automations.length === 0 ? (
              <div className="glass-panel rounded-xl p-6 text-center">
                <Workflow className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium">No routines yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Try: “{EXAMPLE}”. Helix will check what is connected and tell you what is missing.</p>
              </div>
            ) : (
              snap.automations.map((a) => {
                const last = snap.runs.find((r) => r.automationId === a.id);
                return (
                  <article key={a.id} id={a.id} className="glass-panel space-y-3 rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{a.name}</h3>
                        <p className="text-xs text-muted-foreground">{describeSchedule(a.trigger)}</p>
                      </div>
                      {statusChip(a.status)}
                    </div>
                    <AutomationCanvas spec={a} conn={snap.connections} run={last} />
                    {a.status === "draft" && a.missing.length > 0 ? (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                        <p className="text-xs font-semibold text-amber-500">Not active yet. Nothing is sent until this is done:</p>
                        <ul className="mt-2 space-y-2">
                          {a.missing.map((r, i) => (
                            <RequirementRow key={i} spec={a} req={r} detectedTz={detectedTz} busy={busy} onAct={(b) => void act(b)} />
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {a.status === "draft" && a.missing.length === 0 && !a.confirmedAt ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                        <p className="text-xs text-foreground">Ready. Confirm to start sending on schedule.</p>
                        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void act({ action: "confirm", id: a.id })}>
                          Confirm and activate
                        </button>
                      </div>
                    ) : null}
                    {last ? (
                      <p className="text-xs text-muted-foreground">
                        Last run: {runChip(last)} · {new Date(last.finishedAt).toLocaleString()}
                        {last.error ? <span className="text-red-500"> · {last.error}</span> : null}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btn} disabled={busy} onClick={() => void act({ action: "run", id: a.id, preview: true })}>
                        <Play className="size-3.5" aria-hidden /> Preview now
                      </button>
                      {snap.mode === "live" && a.confirmedAt ? (
                        <button type="button" className={btn} disabled={busy} onClick={() => void act({ action: "run", id: a.id, preview: false })}>
                          <Send className="size-3.5" aria-hidden /> Send now
                        </button>
                      ) : null}
                      {a.status === "paused" ? (
                        <button type="button" className={btn} disabled={busy} onClick={() => void act({ action: "resume", id: a.id })}>
                          <Play className="size-3.5" aria-hidden /> Resume
                        </button>
                      ) : (
                        <button type="button" className={btn} disabled={busy} onClick={() => void act({ action: "pause", id: a.id })}>
                          <Pause className="size-3.5" aria-hidden /> Pause
                        </button>
                      )}
                      <button type="button" className={btn} disabled={busy} onClick={() => void act({ action: "delete", id: a.id })}>
                        <Trash2 className="size-3.5" aria-hidden /> Delete
                      </button>
                    </div>
                    {lastRun && lastRun.automationId === a.id ? (
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs font-semibold">
                          {lastRun.preview ? "Preview (nothing was sent)" : "Message sent"} — {lastRun.status === "failed" ? "failed" : "ok"}
                        </p>
                        {lastRun.error ? <p className="mt-1 text-xs text-red-500">{lastRun.error}</p> : null}
                        {lastRun.text ? <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{lastRun.text}</pre> : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>

          <section aria-labelledby="build-h" className="glass-panel space-y-3 rounded-xl p-4">
            <h2 id="build-h" className="text-sm font-semibold">
              Build one
            </h2>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                What to send
                <select value={source} onChange={(e) => setSource(e.target.value)} className={`${field} mt-1 font-normal normal-case`}>
                  {snap.sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Every day at
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${field} mt-1 font-normal`} />
              </label>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Send to
                <select value={channel} onChange={(e) => setChannel(e.target.value)} className={`${field} mt-1 font-normal normal-case`}>
                  {(["in_app", "slack", "whatsapp", "sms"] as const).map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              {phoneChannel ? (
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Your number
                  <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+5215512345678" inputMode="tel" className={`${field} mt-1 font-normal`} />
                </label>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Will include: {snap.sources.find((s) => s.id === source)?.includes.join(", ")}.
              {channel === "whatsapp" ? " WhatsApp can reject a message outside the 24-hour window unless the template is approved." : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={busy || !time || (phoneChannel && !to.trim()) || snap.automations.filter((a) => a.origin === "user").length >= snap.limit}
                onClick={() => void act({ action: "create", source, channel, time, to: phoneChannel ? to.replace(/[^\d+]/g, "") : undefined, confirm: true })}
              >
                Create and confirm
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy || !time || (phoneChannel && !to.trim())}
                onClick={() => void act({ action: "create", source, channel, time, to: phoneChannel ? to.replace(/[^\d+]/g, "") : undefined, confirm: false })}
              >
                Save as draft
              </button>
            </div>
          </section>

          <section aria-labelledby="hist-h" className="space-y-2">
            <h2 id="hist-h" className="text-sm font-semibold">
              History
            </h2>
            {snap.runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing has run yet. Use Preview now on a routine to see exactly what it would send.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {snap.runs.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="font-medium">{nameOf(r.automationId)}</span>
                    <span className="text-muted-foreground">
                      {r.trigger === "schedule" ? "Scheduled" : "Manual"} · {new Date(r.finishedAt).toLocaleString()}
                    </span>
                    <span>{runChip(r)}</span>
                    {r.error ? <span className="w-full text-red-500">{r.error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </PageFrame>
  );
}
