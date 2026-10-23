import Link from "next/link";
import { AskAiBanner } from "@/components/ask-ai-banner";
import { PageFrame, DemoMark } from "@/components/desk-kit";
import type { DatasetBundle, DeskKpis } from "@/lib/types";

const WHY_LABEL: Record<string, string> = {
  date_ambiguous: "Ambiguous MDY/DMY date",
  email_syntax: "Unverified email",
  phone_e164: "Broken phone",
  exact_duplicate: "Exact duplicate row",
  duplicate_key: "Repeated email or phone",
  date_iso: "Invalid or unverified date",
  mixed_types: "Mixed column types",
  outlier: "Marked outlier",
};

function whyRows(bundles: DatasetBundle[]) {
  const counts = new Map<string, number>();
  for (const b of bundles) {
    for (const issue of b.issues) {
      const label = WHY_LABEL[issue.ruleId] ?? issue.ruleId.replace(/_/g, " ");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0) || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n]) => ({ name, n, pct: Math.round((n / total) * 100) }));
}

function pendingCells(bundles: DatasetBundle[]) {
  const out: { key: string; title: string; line: string; kind: "ok" | "hitl" | "hold"; href: string }[] = [];
  for (const b of bundles) {
    for (const change of b.changes) {
      const decision = b.decisions.find((d) => d.changeId === change.id);
      if (decision?.status === "pending") {
        out.push({
          key: `${b.dataset.id}:${change.id}`,
          title: `${change.cellRef} ${change.column}`,
          line: `${change.before} — ${change.evidence}`,
          kind: change.ruleId.includes("ambiguous") ? "hitl" : "hold",
          href: `/datasets/${b.dataset.id}/review`,
        });
      }
    }
  }
  return out.slice(0, 6);
}

export function DeskHome({
  kpis,
  rows,
  mode,
}: {
  kpis: DeskKpis;
  rows: DatasetBundle[];
  mode: string;
}) {
  const demo = mode === "demo";
  const max = Math.max(1, ...rows.map((b) => Math.max(b.autoCount, b.hitlCount)));
  const why = whyRows(rows);
  const queue = pendingCells(rows);

  return (
    <PageFrame
      title="Dashboard"
      subtitle="Read → profile → map → verify → cell diff → you approve → export a new file. The original is never overwritten."
      chips={demo ? <DemoMark invented /> : null}
    >
      <AskAiBanner />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [String(kpis.datasets), "Datasets on this desk"],
          [String(kpis.rows), "Rows in originals"],
          [String(kpis.hitlPending), "HITL cells waiting"],
          [String(kpis.autoApproved), "Auto-approved"],
        ].map(([n, l]) => (
          <div key={l} className="paper-plate rounded-2xl px-4 py-4">
            <p className="text-[22px] font-semibold tracking-tight">{n}</p>
            <p className="mt-1 text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="paper-plate rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Datasets</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Each upload keeps an immutable original. Cleaning writes a copy.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium">Rows</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Queue</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-muted-foreground">
                      Upload a sheet to profile it.
                    </td>
                  </tr>
                ) : (
                  rows.map((b) => (
                    <tr key={b.dataset.id} className="border-t border-border">
                      <td className="py-3">
                        <Link href={`/datasets/${b.dataset.id}`} className="font-medium hover:text-accent">
                          {b.dataset.name}
                        </Link>
                        <span className={`mt-0.5 block text-[11px] ${b.hitlCount > 0 ? "text-hitl" : "text-accent"}`}>
                          {b.dataset.invented ? "Invented demo" : b.hitlCount > 0 ? "Waiting" : "Original intact"}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{b.original.rows}</td>
                      <td className="py-3 text-muted-foreground">{b.hitlCount > 0 ? "Waiting" : "Ready to export"}</td>
                      <td className="py-3 text-right tabular-nums">
                        <Link className="text-hitl hover:underline" href={`/datasets/${b.dataset.id}/review`}>
                          {b.hitlCount} HITL
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="paper-plate rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Auto vs HITL</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Safe rules run. Ambiguous cells wait.</p>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-accent" /> Auto-approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-hitl" /> HITL
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <div className="mt-4 flex h-[200px] items-stretch justify-between gap-2">
              {rows.slice(0, 6).map((b) => (
                <div key={b.dataset.id} className="flex min-w-0 flex-1 flex-col items-center">
                  <div className="flex h-[160px] w-full flex-col">
                    <div className="flex flex-1 items-end justify-center">
                      <span
                        className="w-[55%] max-w-8 rounded-t-md bg-accent"
                        style={{ height: `${(b.autoCount / max) * 100}%` }}
                      />
                    </div>
                    <div className="h-px w-full bg-border" />
                    <div className="flex flex-1 items-start justify-center">
                      <span
                        className="w-[55%] max-w-8 rounded-b-md bg-hitl/85"
                        style={{ height: `${(b.hitlCount / max) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 w-full truncate text-center text-[10px] text-muted-foreground" title={b.dataset.name}>
                    {b.dataset.name.replace(/\.(csv|xlsx|xls)$/i, "")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="paper-plate rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Why cells wait</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Helix never guesses 03/04 or invents an email.</p>
          <ul className="mt-4 space-y-3.5">
            {why.length === 0 ? (
              <li className="text-sm text-muted-foreground">No issues on this desk.</li>
            ) : (
              why.map((r) => (
                <li key={r.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">{r.n} cells</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-hitl" style={{ width: `${r.pct}%` }} />
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="paper-plate rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Cell queue</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Cite the cell. Unverified stays unverified. Export is always a new file.</p>
          <ul className="mt-3 space-y-1">
            {queue.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">No cells waiting on a person.</li>
            ) : (
              queue.map((q) => (
                <li key={q.key}>
                  <Link href={q.href} className="flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-surface-muted">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-semibold ${
                        q.kind === "hitl" ? "bg-hitl/15 text-hitl" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q.kind === "hitl" ? "HITL" : "HOLD"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{q.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{q.line}</span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </PageFrame>
  );
}
