"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageFrame, DemoMark } from "@/components/desk-kit";
import type { DatasetBundle } from "@/lib/types";

export default function DatasetsPage() {
  const [rows, setRows] = useState<DatasetBundle[]>([]);
  const [mode, setMode] = useState("");

  useEffect(() => {
    void fetch("/api/datasets")
      .then((r) => r.json())
      .then((d: { datasets: DatasetBundle[]; mode: string }) => {
        setRows(d.datasets ?? []);
        setMode(d.mode);
      });
  }, []);

  return (
    <PageFrame
      title="Datasets"
      subtitle="Each upload keeps an immutable original version. Cleaning writes a copy."
      chips={mode === "demo" ? <DemoMark invented /> : null}
    >
      <div className="overflow-x-auto rounded-xl border border-border paper-plate">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">HITL</th>
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Original</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.dataset.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/datasets/${b.dataset.id}`} className="font-medium hover:text-accent">
                    {b.dataset.name}
                  </Link>
                  {b.dataset.invented ? (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-hitl">Invented demo</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono">{b.original.rows}</td>
                <td className="px-4 py-3">{b.hitlCount}</td>
                <td className="px-4 py-3">{b.autoCount}</td>
                <td className="px-4 py-3 font-mono text-xs">{b.original.hash.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  );
}
