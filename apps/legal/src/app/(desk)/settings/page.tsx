"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_STRUCTURED,
  JURISDICTIONS,
  PRACTICE_OPTIONS,
  parseProfile,
  serializeProfile,
  type StructuredProfile,
} from "@/lib/client-profile";
import { StackedBar } from "@helix/ui";
import { Ink } from "@/components/desk-charts";
import { normalizeWeights } from "@/lib/desk-metrics";
import { formatUsdAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { KEYS_LEGAL } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";
import { DEFAULT_WEIGHTS, loadDeskWeights, saveDeskWeights, type DeskWeights } from "@/lib/desk-strategy";

export default function SettingsPage() {
  const [structured, setStructured] = useState<StructuredProfile>(DEFAULT_STRUCTURED);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<DeskWeights>(DEFAULT_WEIGHTS);
  const [weightsSaved, setWeightsSaved] = useState(false);

  useEffect(() => {
    setWeights(loadDeskWeights());
  }, []);

  useEffect(() => {
    void fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((d: { clientProfile?: string }) => {
        if (d.clientProfile) setStructured(parseProfile(d.clientProfile));
      });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/settings/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_profile: serializeProfile(structured) }),
    });
    const data = (await res.json()) as { clientProfile?: string; error?: string };
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    if (data.clientProfile) setStructured(parseProfile(data.clientProfile));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  const WEIGHT_META: Record<string, { label: string; color: string }> = {
    jurisdiction: { label: "Jurisdiction", color: "#f59e0b" },
    margin: { label: "Margin", color: "#cbd5e1" },
    effort: { label: "Effort", color: "#3b5b8c" },
  };
  const shares = normalizeWeights(weights).map((w) => ({ ...w, label: WEIGHT_META[w.key]?.label ?? w.key, color: WEIGHT_META[w.key]?.color ?? "#94a3b8" }));
  const shareOf = (key: string) => shares.find((x) => x.key === key)?.share ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Paste API keys, then keep the client profile that feeds match scoring, Go/No-Go, and proposal drafts.
        </p>
      </div>
      <section className="glass-card space-y-2 rounded-2xl p-6 text-sm text-slate-300">
        <h2 className="text-sm font-semibold text-white">Data handling</h2>
        <p>Traffic to this desk uses TLS 1.3. Helix does not send your RFPs to train public models.</p>
        <p>SOC 2 Type II and ISO 27001 are not attested on this build. Do not tell a client the firm holds those certifications because of Helix.</p>
      </section>
      <section className="glass-card rounded-2xl p-6">
        <ApiKeysForm initialFields={KEYS_LEGAL} />
      </section>
      <section className="glass-card rounded-2xl p-6">
        <DeskOpsForm />
      </section>
      <section className="glass-card space-y-4 rounded-2xl p-6">
        <div>
          <h2 className="text-sm font-semibold text-white">Desk strategy weights</h2>
          <p className="mt-1 text-xs text-slate-400">
            Relative weights for jurisdiction, financial margin, and effort. The bar shows each as a share of the total. Stored on this browser.
          </p>
        </div>
        <Ink>
          <StackedBar
            ariaLabel={`Desk strategy mix: ${shares.map((x) => `${x.share}% ${x.label}`).join(", ")}`}
            segments={shares.map((x) => ({ label: `${x.label} ${x.share}%`, value: x.value, color: x.color }))}
          />
        </Ink>
        {(
          [
            ["jurisdiction", "Jurisdiction"],
            ["margin", "Financial margin"],
            ["effort", "Effort hours"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-xs text-slate-300">
            {label} · weight {weights[key]} · {shareOf(key)}% of the mix
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key]}
              className="mt-2 w-full"
              onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
            />
          </label>
        ))}
        <button
          type="button"
          className="min-h-10 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white"
          onClick={() => {
            saveDeskWeights(weights);
            setWeightsSaved(true);
            window.setTimeout(() => setWeightsSaved(false), 1600);
          }}
        >
          {weightsSaved ? "Saved" : "Save weights"}
        </button>
      </section>
      <form className="glass-card space-y-5 rounded-2xl p-6" onSubmit={(e) => void save(e)}>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">Practice areas</p>
          <div className="flex flex-wrap gap-1.5">
            {PRACTICE_OPTIONS.map((area) => {
              const on = structured.practiceAreas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  className={cn(
                    "min-h-9 rounded-full border px-3 py-1 text-xs font-medium",
                    on
                      ? "border-gold-500/25 bg-gold-500/12 text-gold-500"
                      : "border-white/10 bg-white/5 text-slate-400"
                  )}
                  onClick={() =>
                    setStructured((p) => ({
                      ...p,
                      practiceAreas: on ? p.practiceAreas.filter((a) => a !== area) : [...p.practiceAreas, area],
                    }))
                  }
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Budget {formatUsdAmount(String(structured.budgetMin))}–{formatUsdAmount(String(structured.budgetMax))}
          </p>
          <input
            type="range"
            min={10000}
            max={400000}
            step={5000}
            value={structured.budgetMax}
            className="w-full accent-[#d4af37]"
            onChange={(e) =>
              setStructured((p) => ({
                ...p,
                budgetMax: Number(e.target.value),
                budgetMin: Math.min(p.budgetMin, Number(e.target.value) - 5000),
              }))
            }
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">Jurisdiction</p>
          <select
            className="h-9 w-full rounded-lg border border-slate-700/70 bg-navy-950 px-3 text-sm"
            value={structured.jurisdiction}
            onChange={(e) => setStructured((p) => ({ ...p, jurisdiction: e.target.value }))}
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">Exclusions</p>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-slate-700/70 bg-[#121E36] px-3.5 py-2.5 text-xs text-slate-300"
            value={structured.exclusions.join(", ")}
            onChange={(e) =>
              setStructured((p) => ({
                ...p,
                exclusions: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button type="submit" className="btn-gold rounded-xl px-4 py-2.5 text-sm font-bold">
          {saved ? "Saved" : "Save profile"}
        </button>
      </form>
    </main>
  );
}
