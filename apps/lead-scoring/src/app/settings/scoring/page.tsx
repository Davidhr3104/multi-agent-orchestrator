"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { readOnboarding, writeOnboarding } from "@/lib/prefs";

type Rule = {
  id: string;
  code: string;
  title: string;
  pts?: number;
  chips: string[];
  matchLabel: string;
  enabled: boolean;
  kind?: "gate";
};

type Category = {
  id: string;
  icon: string;
  title: string;
  weightLabel: string;
  weightTone: "primary" | "secondary" | "tertiary" | "error";
  blurb: string;
  rules: Rule[];
};

const WEIGHTS = [
  { id: "firm", label: "Firmographic", pts: 35, color: "#06b6d4" },
  { id: "buyer", label: "Buyer Persona", pts: 30, color: "#67e8f9" },
  { id: "intent", label: "Buying Intent", pts: 25, color: "#4edea3" },
  { id: "tech", label: "Tech Stack Signals", pts: 10, color: "#64748b" },
];

const RULES_STORAGE_KEY = "helix-leads-scoring-rules";

function mergeWithInitial(stored: unknown): Category[] {
  if (!Array.isArray(stored)) return INITIAL.map((c) => ({ ...c, rules: c.rules.map((r) => ({ ...r })) }));
  const storedCats = stored as Category[];
  const byId = new Map(storedCats.map((c) => [c.id, c]));
  const merged: Category[] = INITIAL.map((base) => {
    const saved = byId.get(base.id);
    if (!saved) return { ...base, rules: base.rules.map((r) => ({ ...r })) };
    const savedRules = new Map((saved.rules ?? []).map((r) => [r.id, r]));
    const rules = base.rules.map((r) => {
      const s = savedRules.get(r.id);
      return s ? { ...r, enabled: Boolean(s.enabled), title: s.title ?? r.title, pts: s.pts ?? r.pts } : { ...r };
    });
    const baseIds = new Set(base.rules.map((r) => r.id));
    for (const extra of saved.rules ?? []) {
      if (!baseIds.has(extra.id)) rules.push({ ...extra });
    }
    return { ...base, rules };
  });
  const known = new Set(INITIAL.map((c) => c.id));
  for (const extra of storedCats) {
    if (!known.has(extra.id)) merged.push({ ...extra, rules: (extra.rules ?? []).map((r) => ({ ...r })) });
  }
  return merged;
}

function persistRules(cats: Category[]) {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(cats));
  } catch {
    /* ignore quota */
  }
}

const INITIAL: Category[] = [
  {
    id: "firm",
    icon: "domain",
    title: "Firmographic & Company Size",
    weightLabel: "Weight: 35 pts",
    weightTone: "primary",
    blurb: "Signals from enrichment, reverse IP, and domain registration",
    rules: [
      {
        id: "1.1",
        code: "RULE 1.1",
        title: "Employee Count >= 100 & Tech/SaaS Sector",
        pts: 25,
        chips: ["headcount >= 100", "industry IN ['software', 'fintech', 'ai']"],
        matchLabel: "Live Match: seed-aware",
        enabled: true,
      },
      {
        id: "1.2",
        code: "RULE 1.2",
        title: "Estimated Annual Revenue > $10M",
        pts: 10,
        chips: ["revenue_arr >= 10000000"],
        matchLabel: "Enrichment optional",
        enabled: true,
      },
    ],
  },
  {
    id: "buyer",
    icon: "badge",
    title: "Buyer Persona & Authority",
    weightLabel: "Weight: 30 pts",
    weightTone: "secondary",
    blurb: "Decision-maker status and email validation",
    rules: [
      {
        id: "2.1",
        code: "RULE 2.1",
        title: "Executive Decision Maker (VP, C-Level, Founder)",
        pts: 20,
        chips: ["regex: /^(VP|CTO|CEO|CPO|Founder|Head of)/i"],
        matchLabel: "Title NLP",
        enabled: true,
      },
      {
        id: "2.2",
        code: "RULE 2.2",
        title: "Direct Business Work Email Verified (Non-generic)",
        pts: 10,
        chips: ["email.mx_valid == true", "email.is_free == false"],
        matchLabel: "MX check",
        enabled: true,
      },
    ],
  },
  {
    id: "intent",
    icon: "speed",
    title: "Buying Intent & Velocity",
    weightLabel: "Weight: 25 pts",
    weightTone: "tertiary",
    blurb: "Urgency scoring and competitor displacement markers",
    rules: [
      {
        id: "3.1",
        code: "RULE 3.1",
        title: "Implementation Timeline < 30 Days",
        pts: 15,
        chips: ["intent.urgency == 'immediate'", "timeline_days <= 30"],
        matchLabel: "Message NLP",
        enabled: true,
      },
      {
        id: "3.2",
        code: "RULE 3.2",
        title: "Competitor Replacement Keyword Mentioned",
        pts: 10,
        chips: ["entities.competitor_switch == true", "tags: switching from"],
        matchLabel: "Entity extract",
        enabled: true,
      },
    ],
  },
  {
    id: "gates",
    icon: "gavel",
    title: "Hard Disqualification Gates",
    weightLabel: "Immediate 0 or Rejection",
    weightTone: "error",
    blurb: "Circuit breakers before heuristic evaluation",
    rules: [
      {
        id: "4.1",
        code: "GATE 4.1",
        title: "Disposable Email Provider or Free Webmail without corporate IP",
        chips: ["ACTION: Flag as SPAM, score forced to 0"],
        matchLabel: "Banlist",
        enabled: true,
        kind: "gate",
      },
      {
        id: "4.2",
        code: "GATE 4.2",
        title: "Unserviceable Region / Sanctioned Country",
        chips: ["ACTION: Hard Reject & Archive", "geo.country IN OFAC_LIST"],
        matchLabel: "Geo gate",
        enabled: true,
        kind: "gate",
      },
      {
        id: "4.3",
        code: "GATE 4.3",
        title: "Low Message Entropy / Bot Form Submission",
        chips: ["ACTION: Quarantine for Review", "shannon_entropy < 2.1"],
        matchLabel: "Bot detect",
        enabled: true,
        kind: "gate",
      },
    ],
  },
];

function Toggle({
  checked,
  onChange,
  tone = "primary",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "primary" | "error";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition",
        checked ? (tone === "error" ? "bg-error" : "bg-primary") : "bg-surface-container-highest"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-on-surface transition",
          checked ? "left-4" : "left-0.5"
        )}
      />
    </button>
  );
}

function WeightDonut() {
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = WEIGHTS.map((w) => {
    const len = (w.pts / 100) * c;
    const seg = { ...w, dash: `${len} ${c - len}`, offset: -offset };
    offset += len;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative flex size-36 shrink-0 items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#282a30" strokeWidth="12" />
          {segs.map((s) => (
            <circle
              key={s.id}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-semibold text-on-surface">100</span>
          <span className="text-[10px] font-medium tracking-wider text-outline uppercase">Max pts</span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-1.5">
        {WEIGHTS.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between rounded-md bg-surface-container px-2 py-1.5"
          >
            <span className="flex items-center gap-2 text-sm text-on-surface">
              <span className="size-2.5 rounded-full" style={{ background: w.color }} />
              {w.label}
            </span>
            <span className="font-mono text-[11px] text-on-surface-variant">
              {w.pts} pts ({w.pts}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScoringSettingsPage() {
  const [cats, setCats] = useState(INITIAL);
  const [hitl, setHitl] = useState(65);
  const [autoQualifyScore, setAutoQualifyScore] = useState(80);
  const [dqScore, setDqScore] = useState(50);
  const [saved, setSaved] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simNote, setSimNote] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RULES_STORAGE_KEY);
      if (raw) setCats(mergeWithInitial(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
    setHydrated(true);
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { hitl?: number; disabledRuleIds?: string[]; thresholds?: { autoQualifyScore?: number; dqScore?: number } }) => {
        setHitl(Math.round((d.hitl ?? 0.65) * 100));
        if (d.thresholds?.autoQualifyScore != null) setAutoQualifyScore(d.thresholds.autoQualifyScore);
        if (d.thresholds?.dqScore != null) setDqScore(d.thresholds.dqScore);
        if (Array.isArray(d.disabledRuleIds) && d.disabledRuleIds.length) {
          const disabled = new Set(d.disabledRuleIds);
          setCats((prev) =>
            prev.map((c) => ({
              ...c,
              rules: c.rules.map((r) => ({ ...r, enabled: !disabled.has(r.id) })),
            }))
          );
        }
      });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistRules(cats);
  }, [cats, hydrated]);

  const ruleCount = useMemo(
    () => cats.reduce((n, c) => n + c.rules.filter((r) => r.enabled).length, 0),
    [cats]
  );

  const triageLo = dqScore + 1;
  const triageHi = autoQualifyScore - 1;

  async function saveHitl() {
    const disabledRuleIds = cats.flatMap((c) =>
      c.rules.filter((r) => !r.enabled).map((r) => r.id)
    );
    await fetch("/api/settings/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hitl: hitl / 100, disabledRuleIds, thresholds: { autoQualifyScore, dqScore } }),
    });
    writeOnboarding({ ...readOnboarding(), scoring: true });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function toggleRule(catId: string, ruleId: string, enabled: boolean) {
    setCats((prev) => {
      const next = prev.map((c) =>
        c.id !== catId
          ? c
          : { ...c, rules: c.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)) }
      );
      persistRules(next);
      return next;
    });
  }

  function addRule() {
    const title = window.prompt("Rule title");
    if (!title?.trim()) return;
    const ptsRaw = window.prompt("Points (number)", "10");
    if (ptsRaw == null) return;
    const pts = Number(ptsRaw);
    if (!Number.isFinite(pts)) {
      setSimNote("Invalid points — rule not added.");
      return;
    }
    const stamp = Date.now().toString(36).slice(-5);
    const rule: Rule = {
      id: `custom-${stamp}`,
      code: `RULE ${stamp.toUpperCase()}`,
      title: title.trim(),
      pts,
      chips: ["custom"],
      matchLabel: "Custom",
      enabled: true,
    };
    setCats((prev) => {
      let next: Category[];
      if (prev.length > 0) {
        const [first, ...rest] = prev;
        next = [{ ...first, rules: [...first.rules, rule] }, ...rest];
      } else {
        next = [
          {
            id: "custom",
            icon: "tune",
            title: "Custom",
            weightLabel: "Custom rules",
            weightTone: "primary",
            blurb: "Operator-defined scoring rules",
            rules: [rule],
          },
        ];
      }
      persistRules(next);
      return next;
    });
    setSimNote(`Added rule “${title.trim()}” (+${pts} pts)`);
  }

  async function runHistoricalSim() {
    setSimRunning(true);
    setSimNote(null);
    try {
      // Persist current rule toggles so pipeline gates see them
      const disabledRuleIds = cats.flatMap((c) =>
        c.rules.filter((r) => !r.enabled).map((r) => r.id)
      );
      await fetch("/api/settings/brain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hitl: hitl / 100, disabledRuleIds, thresholds: { autoQualifyScore, dqScore } }),
      });

      const res = await fetch("/api/leads");
      const data = (await res.json()) as { leads?: { id: string; score: number; tier: string; name: string }[] };
      const leads = data.leads ?? [];
      if (leads.length === 0) {
        setSimNote("No roster leads to simulate.");
        return;
      }
      const sample = [...leads].sort((a, b) => b.score - a.score).slice(0, 3);
      const before = sample.map((l) => l.score);
      const after: number[] = [];
      for (const lead of sample) {
        const scoreRes = await fetch(`/api/leads/${lead.id}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "pipeline" }),
        });
        const scored = (await scoreRes.json()) as { lead?: { score: number } };
        after.push(scored.lead?.score ?? lead.score);
      }
      const avgBefore = Math.round(before.reduce((s, n) => s + n, 0) / before.length);
      const avgAfter = Math.round(after.reduce((s, n) => s + n, 0) / after.length);
      setSimNote(
        `Pipeline re-score on ${sample.length} leads · avg ${avgBefore} → ${avgAfter} · gates+rules applied`
      );
      window.dispatchEvent(new Event("helix:leads-refresh"));
    } finally {
      setSimRunning(false);
    }
  }

  const toneBadge: Record<Category["weightTone"], string> = {
    primary: "bg-primary/15 text-primary",
    secondary: "bg-secondary/15 text-secondary",
    tertiary: "bg-tertiary/15 text-tertiary",
    error: "bg-error/20 text-error",
  };

  return (
    <main className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute -top-12 left-1/3 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute top-96 right-12 -z-10 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-secondary" />
            <span className="font-mono text-[10px] tracking-widest text-secondary uppercase">
              Engine configuration · Heuristic evaluator
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
            Scoring Rules &amp; Qualification Criteria
          </h1>
          <p className="text-sm text-on-surface-variant">
            Deterministic weights, ICP thresholds, signal boosts, and hard disqualification gates.
            HITL band is live from desk settings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveHitl()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <span className="size-2 rounded-full bg-tertiary" />
            Save HITL + rules ({hitl}%)
          </button>
          <button
            type="button"
            onClick={() => void runHistoricalSim()}
            disabled={simRunning}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">play_circle</span>
            {simRunning ? "Re-scoring…" : "Test Rule Set"}
          </button>
          <button
            type="button"
            onClick={addRule}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-xs font-semibold text-on-primary-container"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Rule
          </button>
        </div>
      </div>

      {saved ? <p className="text-xs text-tertiary">HITL + disabled rules saved to brain.</p> : null}
      {simNote ? <p className="text-xs text-secondary">{simNote}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-wider text-outline uppercase">
              Active Scoring Rules
            </span>
            <span className="flex size-7 items-center justify-center rounded bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-on-surface">{ruleCount} Rules</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="size-1.5 rounded-full bg-tertiary" />
            Across {cats.length} functional categories
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-wider text-outline uppercase">
              Auto-Qualification
            </span>
            <span className="flex size-7 items-center justify-center rounded bg-tertiary/15 text-tertiary">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-tertiary">≥ {autoQualifyScore} / 100</p>
          <p className="mt-1 text-xs text-on-surface-variant">Auto-routed to AE pipeline</p>
          <label className="mt-2 block text-[11px] text-on-surface-variant">
            Auto-qualify at
            <input
              type="number"
              min={dqScore + 1}
              max={100}
              value={autoQualifyScore}
              onChange={(e) => setAutoQualifyScore(Number(e.target.value))}
              className="mt-1 h-8 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-wider text-outline uppercase">
              Human Triage Band
            </span>
            <span className="flex size-7 items-center justify-center rounded bg-secondary/15 text-secondary">
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-secondary">
            {triageLo} – {triageHi} pts
          </p>
          <label className="mt-2 block text-[11px] text-on-surface-variant">
            HITL confidence · {hitl}%
            <input
              type="range"
              min={50}
              max={95}
              value={hitl}
              onChange={(e) => setHitl(Number(e.target.value))}
              className="mt-1 w-full accent-[#06b6d4]"
            />
          </label>
          <p className="mt-1 text-[10px] text-outline">
            Confidence threshold, not a score band — the score band shown above ({triageLo}–{triageHi} pts) is derived from Auto-qualify/Disqualify.
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-wider text-outline uppercase">
              Auto-Disqualification
            </span>
            <span className="flex size-7 items-center justify-center rounded bg-error/15 text-error">
              <span className="material-symbols-outlined text-[18px]">block</span>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-error">&lt; {dqScore} pts</p>
          <label className="mt-2 block text-[11px] text-on-surface-variant">
            Disqualify below
            <input
              type="number"
              min={0}
              max={autoQualifyScore - 1}
              value={dqScore}
              onChange={(e) => setDqScore(Number(e.target.value))}
              className="mt-1 h-8 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          </label>
          <p className="mt-1 text-xs text-on-surface-variant">Quarantined / hard reject</p>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          {cats.map((cat) => (
            <section key={cat.id} className="overflow-hidden rounded-xl bg-surface-container-low">
              <div className="flex items-center justify-between bg-surface-container p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded bg-surface-container-high",
                      cat.weightTone === "primary" && "text-primary",
                      cat.weightTone === "secondary" && "text-secondary",
                      cat.weightTone === "tertiary" && "text-tertiary",
                      cat.weightTone === "error" && "text-error"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-on-surface">{cat.title}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", toneBadge[cat.weightTone])}>
                        {cat.weightLabel}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{cat.blurb}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-4">
                {cat.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-col justify-between gap-3 rounded-lg bg-surface-container p-4 transition hover:bg-surface-container-high/60 md:flex-row md:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            rule.kind === "gate" ? "text-error" : "text-outline"
                          )}
                        >
                          {rule.code}
                        </span>
                        <span className="text-sm font-semibold text-on-surface">{rule.title}</span>
                        {rule.pts != null ? (
                          <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-medium text-tertiary">
                            +{rule.pts} pts
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rule.chips.map((chip) => (
                          <span
                            key={chip}
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-[10px]",
                              rule.kind === "gate" && chip.startsWith("ACTION")
                                ? "bg-error/15 text-error"
                                : "bg-surface-container-lowest text-secondary"
                            )}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[10px] text-outline">{rule.matchLabel}</span>
                      <Toggle
                        checked={rule.enabled}
                        tone={rule.kind === "gate" ? "error" : "primary"}
                        onChange={(v) => toggleRule(cat.id, rule.id, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="space-y-4 xl:col-span-5">
          <div className="space-y-4 rounded-xl bg-surface-container-low p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">donut_large</span>
                <span className="text-sm font-semibold text-on-surface">Category Weight Allocation</span>
              </div>
              <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-medium text-tertiary">
                Total: 100%
              </span>
            </div>
            <WeightDonut />
          </div>

          <div className="space-y-4 rounded-xl bg-surface-container-low p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-tertiary" />
                <span className="text-sm font-semibold text-on-surface">Live Payload Heuristic Simulator</span>
              </div>
              <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary">
                Active evaluator
              </span>
            </div>

            <div className="space-y-3 rounded-lg bg-surface-container p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
                  MR
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Marcus Reyes</p>
                  <p className="text-xs text-on-surface-variant">Chief Technology Officer @ PayNexus Corp</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ["Verified email", "m.reyes@paynexus.io"],
                  ["Headcount", "280 Employees (Tech)"],
                  ["Est. ARR", "$52M (Series C)"],
                  ["Intent timeline", "< 14 Days (Urgent)"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded bg-surface-container-low p-2">
                    <span className="block font-mono text-[9px] tracking-wider text-outline uppercase">
                      {k}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-on-surface">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
                Step-by-step point accrual
              </span>
              {[
                ["Rule 1.1: Headcount >= 100 & Fintech", "+25"],
                ["Rule 1.2: Annual Revenue > $10M", "+10"],
                ["Rule 2.1: Executive Authority (CTO)", "+20"],
                ["Rule 2.2: Business MX Verified", "+10"],
                ["Rule 3.1: Timeline < 30 Days", "+15"],
              ].map(([label, pts]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded bg-surface-container px-2 py-1.5"
                >
                  <span className="text-xs text-on-surface">{label}</span>
                  <span className="font-mono text-[11px] text-tertiary">{pts} pts</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-tertiary/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-tertiary text-on-tertiary">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                </div>
                <div>
                  <span className="block font-mono text-[10px] tracking-wider text-tertiary uppercase">
                    Evaluated output
                  </span>
                  <span className="text-sm font-semibold text-on-surface">Tier 1 Enterprise (80 / 100)</span>
                </div>
              </div>
              <span className="rounded bg-tertiary px-2.5 py-1 text-[10px] font-bold tracking-wider text-on-tertiary">
                AUTO-ROUTED AE
              </span>
            </div>

            <button
              type="button"
              disabled={simRunning}
              onClick={() => void runHistoricalSim()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-surface-container text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">batch_prediction</span>
              {simRunning ? "Simulating…" : "Simulate on roster leads"}
            </button>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-secondary">
              terminal
            </span>
            <div>
              <p className="text-sm font-semibold text-on-surface">Deterministic Edge Execution</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Heuristic scores evaluate on ingested webhook payloads before write operations in the
                pipeline.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
