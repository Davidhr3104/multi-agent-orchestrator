"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageFrame, DemoMark } from "@/components/desk-kit";
import { ambiguousDateCandidates, type DateReading } from "@/lib/rules";
import type { DatasetBundle, Decision, ProposedChange } from "@/lib/types";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<DatasetBundle | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/datasets/${id}`);
    const d = (await res.json()) as { dataset?: DatasetBundle };
    if (d.dataset) setBundle(d.dataset);
  }

  useEffect(() => {
    void load();
  }, [id]);

  const pending = useMemo(() => {
    if (!bundle) return [];
    const status = new Map(bundle.decisions.map((d) => [d.changeId, d]));
    return bundle.changes.map((c) => ({ change: c, decision: status.get(c.id) }));
  }, [bundle]);

  const hitl = pending.filter((p) => p.decision?.status === "pending");
  const autos = pending.filter((p) => p.decision?.status === "auto_approved" || p.decision?.status === "approved");

  async function act(status: "approved" | "rejected", ids: string[], readings?: Record<string, DateReading>) {
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/datasets/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeIds: ids, status, readings }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "The decision could not be saved.");
    }
    setChecked(new Set());
    await load();
    setBusy(false);
  }

  if (!bundle) return <PageFrame title="Review">Loading…</PageFrame>;

  return (
    <PageFrame
      title="Cell-level diff"
      subtitle="Each change keeps original value, rule, origin, confidence, who approved, and when. Ambiguous dates stay HITL."
      chips={bundle.dataset.invented ? <DemoMark invented /> : null}
      actions={
        <>
          <a className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground" href={`/api/datasets/${id}/export`}>
            Export cleaned copy
          </a>
          <Link className="rounded-md border border-border px-3 py-1.5 text-xs" href={`/datasets/${id}/publish`}>
            Dry-run publish
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || checked.size === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => void act("approved", [...checked])}
        >
          Approve selected
        </button>
        <button
          type="button"
          disabled={busy || checked.size === 0}
          className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          onClick={() => void act("rejected", [...checked])}
        >
          Reject selected
        </button>
        <p className="self-center text-xs text-muted-foreground">Export always writes a new file. Undo = discard the copy.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium">
          {error}
        </p>
      ) : null}

      <DiffTable
        title="HITL — confirm these"
        rows={hitl}
        checked={checked}
        setChecked={setChecked}
        busy={busy}
        onReadDate={(changeId, reading) => void act("approved", [changeId], { [changeId]: reading })}
        amber
      />
      <DiffTable title="Auto-approved deterministic rules" rows={autos} checked={checked} setChecked={setChecked} />

      <section className="paper-plate rounded-xl p-4">
        <h2 className="mb-2 text-sm font-semibold">Issues with no cell rewrite</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {bundle.issues.map((i) => (
            <li key={i.id}>
              <span className="font-mono text-hitl">{i.ruleId}</span> · {i.column}
              {i.rowIndex >= 0 ? ` row ${i.rowIndex + 2}` : ""} — {i.message}
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}

function DiffTable({
  title,
  rows,
  checked,
  setChecked,
  busy,
  onReadDate,
  amber,
}: {
  title: string;
  rows: { change: ProposedChange; decision?: Decision }[];
  checked: Set<string>;
  setChecked: (s: Set<string>) => void;
  busy?: boolean;
  onReadDate?: (changeId: string, reading: DateReading) => void;
  amber?: boolean;
}) {
  return (
    <section className="paper-plate overflow-x-auto rounded-xl p-4">
      <h2 className={`mb-3 text-sm font-semibold ${amber ? "text-hitl" : ""}`}>{title}</h2>
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2" />
            <th className="py-2">Cell</th>
            <th className="py-2">Original</th>
            <th className="py-2">Proposed</th>
            <th className="py-2">Rule</th>
            <th className="py-2">Origin</th>
            <th className="py-2">Conf.</th>
            <th className="py-2">Approved by</th>
            <th className="py-2">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ change, decision }) => {
            const readings =
              decision?.status === "pending" && change.ruleId === "date_ambiguous" && onReadDate
                ? ambiguousDateCandidates(change.before)
                : null;
            return (
            <tr key={change.id} className="border-t border-border">
              <td className="py-2">
                {decision?.status === "pending" && !readings ? (
                  <input
                    type="checkbox"
                    checked={checked.has(change.id)}
                    onChange={() => {
                      const next = new Set(checked);
                      if (next.has(change.id)) next.delete(change.id);
                      else next.add(change.id);
                      setChecked(next);
                    }}
                  />
                ) : null}
              </td>
              <td className="py-2 font-mono">{change.cellRef}</td>
              <td className="py-2 font-mono text-destructive">{change.before || "∅"}</td>
              <td className="py-2 font-mono text-teal">
                {readings ? (
                  <span className="flex flex-wrap gap-1">
                    {(["mdy", "dmy"] as const).map((reading) => (
                      <button
                        key={reading}
                        type="button"
                        disabled={busy}
                        onClick={() => onReadDate?.(change.id, reading)}
                        className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                      >
                        Read as {reading.toUpperCase()} → {readings[reading]}
                      </button>
                    ))}
                  </span>
                ) : (
                  change.after
                )}
              </td>
              <td className="py-2">{change.ruleId}</td>
              <td className="py-2">{change.origin}</td>
              <td className="py-2">{Math.round(change.confidence * 100)}%</td>
              <td className="py-2">{decision?.decidedBy || "—"}</td>
              <td className="py-2">{decision?.decidedAt ? decision.decidedAt.slice(0, 19) : "—"}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
