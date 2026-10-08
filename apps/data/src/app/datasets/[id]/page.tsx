"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChartCard, Heatmap, ScoreRing } from "@helix/ui";
import { IMPORT_CONTRACTS } from "@/lib/contracts";
import { PageFrame, DemoMark } from "@/components/desk-kit";
import type { DatasetBundle, ImportContract } from "@/lib/types";

export default function DatasetProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<DatasetBundle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/datasets/${id}`)
      .then(async (r) => {
        const d = (await r.json()) as { dataset?: DatasetBundle; error?: string };
        if (!r.ok || !d.dataset) setNotice(d.error ?? "Dataset not found.");
        else setBundle(d.dataset);
      })
      .catch(() => setNotice("Dataset not found."));
  }, [id]);

  if (!bundle) {
    return <PageFrame title="Dataset">{notice ?? "Loading…"}</PageFrame>;
  }

  async function saveMap(targetApp: ImportContract["app"]) {
    const res = await fetch(`/api/datasets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetApp }),
    });
    const d = (await res.json()) as { dataset?: DatasetBundle };
    if (d.dataset) setBundle(d.dataset);
  }

  const avg = bundle.profiles.reduce((s, p) => s + p.completeness, 0) / Math.max(1, bundle.profiles.length);

  return (
    <PageFrame
      title={bundle.dataset.name}
      subtitle={`Original stored as ${bundle.original.storageKey}. Hash ${bundle.original.hash.slice(0, 16)}. Cap 5,000 rows.`}
      chips={bundle.dataset.invented ? <DemoMark invented /> : null}
      actions={
        <>
          <Link className="rounded-md border border-hitl/40 px-3 py-1.5 text-xs text-hitl" href={`/datasets/${id}/review`}>
            Cell review
          </Link>
          <Link className="rounded-md border border-border px-3 py-1.5 text-xs" href={`/datasets/${id}/publish`}>
            Dry-run publish
          </Link>
        </>
      }
    >
      {bundle.truncated ? (
        <p className="rounded-md border border-hitl/40 bg-hitl/10 px-3 py-2 text-sm">
          File truncated at 5,000 rows. Extra rows were not read.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Completeness" demo={bundle.dataset.invented} source="Non-empty cells / all cells.">
          <ScoreRing score={Math.round(avg * 100)} size={80} />
        </ChartCard>
        <ChartCard title="Column issues" demo={bundle.dataset.invented} source="Profile + rule findings. Outliers are marked, never rewritten.">
          <Heatmap
            rows={["issues"]}
            columns={bundle.profiles.map((p) => p.column)}
            cells={[bundle.profiles.map((p) => p.issueCount)]}
            color="#1ad4c4"
            ariaLabel="Issue heatmap"
          />
        </ChartCard>
        <ChartCard title="Pipeline" source="Mapping uses header names. Confirm the contract below.">
          <ol className="space-y-1 text-xs text-muted-foreground">
            <li>1. Read (xlsx/csv)</li>
            <li>2. Profile types, completeness, dupes</li>
            <li>3. Map columns (confirm below)</li>
            <li>4. Verify — unverified stays unverified</li>
            <li>5. Propose cell diffs</li>
            <li>6. You approve HITL</li>
            <li>7. Export a new file</li>
          </ol>
        </ChartCard>
      </div>

      <section className="paper-plate rounded-xl p-4">
        <h2 className="mb-3 text-sm font-semibold">Map to a Helix contract</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Destination apps keep their own scoring rules. Data only delivers clean rows. Mapping is from the header text — confirm it.
        </p>
        <label className="mb-4 flex items-center gap-2 text-xs">
          Target
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
            value={bundle.targetApp}
            onChange={(e) => void saveMap(e.target.value as ImportContract["app"])}
          >
            {IMPORT_CONTRACTS.map((c) => (
              <option key={c.app} value={c.app}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Column</th>
                <th className="py-2 text-left">Type</th>
                <th className="py-2 text-left">Complete</th>
                <th className="py-2 text-left">Maps to</th>
                <th className="py-2 text-left">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {bundle.profiles.map((p) => {
                const map = bundle.mapping.find((m) => m.column === p.column);
                return (
                  <tr key={p.column} className="border-t border-border">
                    <td className="py-2 font-medium">{p.column}</td>
                    <td className="py-2">{p.inferredType}</td>
                    <td className="py-2 font-mono">{Math.round(p.completeness * 100)}%</td>
                    <td className="py-2">{map?.field ?? "— unmapped"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{map?.evidence}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}
