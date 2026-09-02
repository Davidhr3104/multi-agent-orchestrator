"use client";

import { useEffect, useState } from "react";
import { HelixPage } from "@/components/helix-page";
import { writeOnboarding, readOnboarding } from "@/lib/prefs";

export default function ScoringSettingsPage() {
  const [hitl, setHitl] = useState(65);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { hitl?: number }) => setHitl(Math.round((d.hitl ?? 0.65) * 100)));
  }, []);

  async function save() {
    await fetch("/api/settings/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hitl: hitl / 100 }),
    });
    writeOnboarding({ ...readOnboarding(), scoring: true });
    setSaved(true);
  }

  return (
    <HelixPage
      title="Scoring Rules"
      hint="Hot ≥ 75, warm ≥ 50. Move the HITL gate: Strict auto-approves only high-confidence leads."
    >
      <div className="card-bg space-y-4 rounded-xl p-5 text-sm text-slate-300">
        <p>Email open +5 · Link click +10 · Pricing visit +15 · Reply +12 · No reply 7d −10.</p>
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400">
            Confidence threshold · {hitl}% {hitl >= 85 ? "(Strict)" : hitl <= 55 ? "(Loose)" : "(Balanced)"}
          </label>
          <input
            type="range"
            min={50}
            max={95}
            value={hitl}
            onChange={(e) => setHitl(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
        </div>
        <button
          type="button"
          className="rounded-md bg-[#38bdf8] px-3 py-1.5 text-sm font-semibold text-slate-900"
          onClick={() => void save()}
        >
          Save
        </button>
        {saved ? <p className="text-xs text-emerald-400">Saved. New ingest uses this gate.</p> : null}
      </div>
    </HelixPage>
  );
}
