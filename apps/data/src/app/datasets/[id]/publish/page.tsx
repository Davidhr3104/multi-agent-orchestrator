"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IMPORT_CONTRACTS } from "@/lib/contracts";
import { PageFrame, DemoMark } from "@/components/desk-kit";
import type { DatasetBundle, ImportContract } from "@/lib/types";

type DryRun = {
  dryRun: true;
  message: string;
  contract: { app: string; name: string; version: number };
  idempotencyKey: string;
  accepted: number;
  rejected: { row: number; reasons: string[] }[];
  originalIntact: boolean;
  invented: boolean;
};

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<DatasetBundle | null>(null);
  const [app, setApp] = useState<ImportContract["app"]>("leads");
  const [result, setResult] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/datasets/${id}`)
      .then(async (r) => {
        const d = (await r.json()) as { dataset?: DatasetBundle; error?: string };
        if (!r.ok || !d.dataset) setNotice(d.error ?? "Dataset not found.");
        else {
          setBundle(d.dataset);
          setApp(d.dataset.targetApp);
        }
      })
      .catch(() => setNotice("Dataset not found."));
  }, [id]);

  async function run() {
    setBusy(true);
    const res = await fetch(`/api/datasets/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetApp: app }),
    });
    const d = (await res.json()) as DryRun & { error?: string };
    if (!d.error) setResult(d);
    setBusy(false);
  }

  if (!bundle) return <PageFrame title="Publish">{notice ?? "Loading…"}</PageFrame>;

  return (
    <PageFrame
      title="Publish dry-run"
      subtitle="This checks the contract and stops. Nothing is sent to Leads, Marketing, or any other Helix."
      chips={bundle.dataset.invented ? <DemoMark invented /> : null}
    >
      <section className="paper-plate max-w-xl space-y-3 rounded-xl p-4">
        <label className="flex flex-col gap-1 text-xs">
          Destination contract
          <select
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={app}
            onChange={(e) => setApp(e.target.value as ImportContract["app"])}
          >
            {IMPORT_CONTRACTS.map((c) => (
              <option key={c.app} value={c.app}>
                {c.name} v{c.version}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {busy ? "Validating…" : "Run dry-run"}
        </button>
      </section>

      {result ? (
        <section className="paper-plate space-y-3 rounded-xl p-4">
          <p className="rounded-md border border-hitl/40 bg-hitl/10 px-3 py-2 text-sm font-medium">{result.message}</p>
          <p className="text-sm">
            {result.contract.name} v{result.contract.version} · accepted {result.accepted} · rejected {result.rejected.length} ·
            original intact: {result.originalIntact ? "yes" : "no"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">Idempotency {result.idempotencyKey}</p>
          <ul className="space-y-1 text-xs">
            {result.rejected.map((r) => (
              <li key={r.row}>
                Row {r.row}: {r.reasons.join(" ")}
              </li>
            ))}
          </ul>
          {result.rejected.length === 0 ? (
            <p className="text-xs text-muted-foreground">No silent drops — every row was classified.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Rejected rows stay visible with a reason. Nothing is posted to another desk.</p>
          )}
        </section>
      ) : null}
    </PageFrame>
  );
}
