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
import { formatUsdAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [structured, setStructured] = useState<StructuredProfile>(DEFAULT_STRUCTURED);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-7 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Client profile feeds match scoring, Go/No-Go, and proposal drafts.</p>
      </div>
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
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
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
