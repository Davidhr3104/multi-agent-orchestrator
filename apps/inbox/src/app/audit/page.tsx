"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartCard, DemoChip, Donut, HBarList, KpiCard } from "@helix/ui";
import { Bot, Gauge as GaugeIcon, ListChecks, UserCheck } from "lucide-react";
import type { AiActionLog } from "@/lib/types";
import { downloadCsv, printReport } from "@/lib/download";
import { actionName, describeLogDecision } from "@/lib/desk-metrics";
import { GhostButton, Grid, PageFrame, SOURCE_DESK, VIOLET, useDeskMode } from "@/components/desk-kit";

const PAGE = 40;

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? "#34d399" : value >= 70 ? VIOLET : "#fbbf24";
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`Confidence ${Math.round(value)} percent`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
      </span>
      <span className="w-9 text-right tabular-nums">{Math.round(value)}%</span>
    </span>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AiActionLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [onlyHuman, setOnlyHuman] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const demo = useDeskMode() === "demo";

  useEffect(() => {
    void fetch("/api/audit")
      .then((r) => r.json())
      .then((d: { logs?: AiActionLog[] }) => setLogs(d.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoaded(true));
  }, []);

  const rows = onlyHuman ? logs.filter((log) => log.humanOverride) : logs;
  const stats = useMemo(() => {
    const human = logs.filter((l) => l.humanOverride).length;
    const avg = logs.length ? logs.reduce((s, l) => s + l.confidenceScore, 0) / logs.length : 0;
    const byAction = new Map<string, { sum: number; n: number }>();
    for (const l of logs) {
      const row = byAction.get(l.actionType) ?? { sum: 0, n: 0 };
      row.sum += l.confidenceScore;
      row.n += 1;
      byAction.set(l.actionType, row);
    }
    const perAction = [...byAction.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 7)
      .map(([type, r]) => {
        const mean = r.sum / r.n;
        return { label: actionName(type), value: Math.round(mean), hint: `${r.n} action${r.n === 1 ? "" : "s"}`, color: mean >= 85 ? "#34d399" : mean >= 70 ? VIOLET : "#fbbf24" };
      });
    return { human, auto: logs.length - human, avg: Math.round(avg), perAction };
  }, [logs]);

  if (!loaded) return <div className="p-8 text-muted-foreground">Loading audit log…</div>;

  return (
    <PageFrame
      title="Audit & learning log"
      chips={demo ? <DemoChip /> : null}
      subtitle="Automatic actions sit next to the ones a person approved or corrected, each with the confidence the model reported."
      actions={
        <>
          <GhostButton onClick={() => { setOnlyHuman((v) => !v); setShown(PAGE); }}>{onlyHuman ? "Show all" : "Human corrections only"}</GhostButton>
          <GhostButton
            onClick={() =>
              downloadCsv(
                "helix-audit.csv",
                rows.map((log) => ({ when: log.createdAt, action: actionName(log.actionType), decision: describeLogDecision(log), confidence: Math.round(log.confidenceScore), source: log.humanOverride ? "Human" : "Automatic" }))
              )
            }
          >
            Export CSV
          </GhostButton>
          <GhostButton
            onClick={() =>
              printReport(
                "Audit trail",
                rows.map((log) => `${new Date(log.createdAt).toLocaleString()} · ${actionName(log.actionType)} · ${log.humanOverride ? "Human" : "Automatic"} · ${Math.round(log.confidenceScore)}% · ${describeLogDecision(log)}`)
              )
            }
          >
            Print PDF
          </GhostButton>
        </>
      }
    >
      <Grid cols={3}>
        <KpiCard label="Logged actions" value={logs.length} hint="newest first" icon={<ListChecks className="size-4" />} accent={VIOLET} />
        <KpiCard label="Avg confidence" value={`${stats.avg}%`} hint="across all actions" icon={<GaugeIcon className="size-4" />} accent="#38bdf8" />
        <KpiCard label="Done by a person" value={logs.length ? `${Math.round((stats.human / logs.length) * 100)}%` : "0%"} hint={`${stats.human} of ${logs.length} actions`} icon={<UserCheck className="size-4" />} accent="#fbbf24" />
      </Grid>

      <Grid cols={2}>
        <ChartCard title="Person or automatic" subtitle="Who made the call" demo={demo} source={SOURCE_DESK}>
          <Donut
            centerValue={logs.length}
            centerLabel="actions"
            ariaLabel="Actions done by a person versus automatically"
            slices={[
              { label: "Automatic", value: stats.auto, color: VIOLET },
              { label: "Done by a person", value: stats.human, color: "#fbbf24" },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>
        <ChartCard title="Confidence by action" subtitle="Mean model confidence per action type" demo={demo} source={SOURCE_DESK}>
          <HBarList items={stats.perAction} format={(n) => `${n}%`} />
        </ChartCard>
      </Grid>

      <div className="glass-panel overflow-hidden rounded-xl">
        <table className="stack-table w-full text-left text-xs">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Decision</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((log) => (
              <tr key={log.id} className="border-b border-border/70">
                <td data-label="When" className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td data-label="Action" className="px-3 py-2">{actionName(log.actionType)}</td>
                <td data-label="Decision" className="px-3 py-2">{describeLogDecision(log)}</td>
                <td data-label="Confidence" className="px-3 py-2"><ConfidenceBar value={log.confidenceScore} /></td>
                <td data-label="Source" className="px-3 py-2">
                  <span className={log.humanOverride ? "inline-flex items-center gap-1 text-amber-500" : "inline-flex items-center gap-1 text-emerald-500"}>
                    {log.humanOverride ? <UserCheck className="size-3" aria-hidden /> : <Bot className="size-3" aria-hidden />}
                    {log.humanOverride ? "Person" : "Automatic"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">No log rows yet. Actions appear here as soon as Helix triages or a person approves something.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {rows.length > shown ? (
          <div className="border-t border-border p-3 text-center">
            <GhostButton onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</GhostButton>
          </div>
        ) : null}
      </div>
    </PageFrame>
  );
}
