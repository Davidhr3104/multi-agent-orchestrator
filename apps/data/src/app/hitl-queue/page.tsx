"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageFrame, DemoMark } from "@/components/desk-kit";
import type { DatasetBundle } from "@/lib/types";

export default function HitlQueuePage() {
  const [rows, setRows] = useState<DatasetBundle[]>([]);
  const [mode, setMode] = useState("");

  useEffect(() => {
    void fetch("/api/datasets")
      .then((r) => r.json())
      .then((d: { datasets: DatasetBundle[]; mode: string }) => {
        setRows((d.datasets ?? []).filter((b) => b.hitlCount > 0));
        setMode(d.mode);
      });
  }, []);

  return (
    <PageFrame
      title="HITL queue"
      subtitle="Ambiguous dates, invalid emails, and anything a rule will not guess. Automate the rest by default."
      chips={mode === "demo" ? <DemoMark invented /> : null}
    >
      {rows.length === 0 ? (
        <p className="paper-plate rounded-xl p-6 text-sm text-muted-foreground">No cells waiting on a person.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.dataset.id} className="paper-plate flex items-center justify-between rounded-xl p-4">
              <div>
                <p className="font-medium">{b.dataset.name}</p>
                <p className="text-xs text-muted-foreground">{b.hitlCount} cells need a decision</p>
              </div>
              <Link className="rounded-md border border-hitl/40 px-3 py-1.5 text-xs text-hitl" href={`/datasets/${b.dataset.id}/review`}>
                Open diff
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
