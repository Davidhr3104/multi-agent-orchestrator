"use client";

import { useEffect, useState } from "react";
import type { StoredLead } from "@helix/core";
import { HelixPage } from "@/components/helix-page";

export default function AuditPage() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/leads")
      .then((r) => r.json())
      .then((data: { leads?: StoredLead[] }) => {
        const items = (data.leads ?? []).flatMap((lead) =>
          (lead.scoreHistory ?? []).map(
            (h) => `${h.at} · ${lead.name} · ${h.score} ${h.tier} — ${h.reason}`
          )
        );
        items.sort((a, b) => b.localeCompare(a));
        setLines(items.slice(0, 80));
      });
  }, []);

  return (
    <HelixPage title="Audit Log" hint="Score history across all leads.">
      <div className="card-bg rounded-xl p-5">
        <ol className="max-h-[70vh] space-y-1 overflow-auto font-mono text-xs text-slate-500">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {lines.length === 0 ? <li>No audit events yet.</li> : null}
        </ol>
      </div>
    </HelixPage>
  );
}
