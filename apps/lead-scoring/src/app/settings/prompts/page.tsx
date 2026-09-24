"use client";

import { useEffect, useMemo, useState } from "react";
import { writeOnboarding, readOnboarding } from "@/lib/prefs";
import { cn } from "@/lib/utils";

const DEFAULT_SYSTEM_LINES = [
  { tone: "primary", text: "You are Helix Lead Evaluator v2.4, an elite B2B qualification engine." },
  { tone: "muted", text: "# Mission Directives" },
  { tone: "body", text: "1. Analyze inbound payload variables against defined ICP heuristics." },
  { tone: "body", text: "2. Calculate composite score [0 - 100] based strictly on the active weight matrix." },
  { tone: "body", text: "3. Deduct 50 points immediately if project timeline is greater than 6 months." },
  { tone: "body", text: "4. Deduct 100 points if corporate email domain fails SPF/DKIM verification." },
  { tone: "muted", text: "# Output Protocol" },
  { tone: "body", text: "You MUST respond strictly with valid RFC8259 JSON matching the provided schema." },
  { tone: "body", text: "Do NOT wrap response in markdown code ticks or conversational preamble." },
  { tone: "body", text: 'Highlight explicit decision drivers inside "reasoning".' },
  {
    tone: "body",
    text: 'Assign automated action tier: "TIER_1_ENTERPRISE", "TIER_2_MID_MARKET", or "DISQUALIFIED".',
  },
];

const DEFAULT_PAYLOAD = `{
  "lead": {
    "name": "Sarah Jenkins",
    "email": "sjenkins@datadog.com",
    "title": "VP of Infrastructure Engineering",
    "declared_budget": 120000,
    "timeline": "Under 30 days - Q3 rollout"
  },
  "enrichment": {
    "employees": 5200,
    "domain_verified": true,
    "industry": "Cloud Monitoring & DevOps"
  }
}`;

const WEIGHTS = [
  {
    label: "Company Size & ICP Tier",
    pct: 35,
    color: "#06b6d4",
    hint: "Enforces Clearbit / Apollo employee tier > 250 FTE",
  },
  {
    label: "Budget & Buying Authority",
    pct: 35,
    color: "#67e8f9",
    hint: "VP/Director title detection + declared $50k+ annual budget",
  },
  {
    label: "Urgency & Deployment Scope",
    pct: 20,
    color: "#4edea3",
    hint: "Active replacement project or < 30-day requirement",
  },
  {
    label: "Corporate MX & Domain Auth",
    pct: 10,
    color: "#908fa0",
    hint: "DNS record validation & non-disposable domain check",
  },
];

type EvalResult = {
  score: number;
  tier: string;
  latencyMs: number;
  confidence: number;
  reasoning?: string;
  classification?: string;
};

function flattenIngestBody(raw: Record<string, unknown>): Record<string, unknown> {
  const lead = (raw.lead as Record<string, unknown> | undefined) ?? raw;
  const enrichment = (raw.enrichment as Record<string, unknown> | undefined) ?? {};
  return {
    name: lead.name ?? lead.full_name,
    email: lead.email,
    company: lead.company ?? enrichment.company ?? enrichment.industry,
    title: lead.title,
    source: lead.source ?? "prompt_studio",
    message: lead.message ?? lead.notes ?? lead.timeline,
    budget: lead.declared_budget ?? lead.budget,
    timeline: lead.timeline,
    employees: enrichment.employees,
    domain_verified: enrichment.domain_verified,
    industry: enrichment.industry,
    ...lead,
  };
}

export default function PromptsPage() {
  const [addendum, setAddendum] = useState("");
  const [hitl, setHitl] = useState(65);
  const [temp, setTemp] = useState(0.2);
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gates, setGates] = useState({
    webmail: true,
    gibberish: true,
    blacklist: true,
  });

  useEffect(() => {
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then(
        (d: {
          addendum?: string;
          hitl?: number;
          gates?: { webmail?: boolean; gibberish?: boolean; blacklist?: boolean };
        }) => {
          setAddendum(d.addendum ?? "");
          setHitl(Math.round((d.hitl ?? 0.65) * 100));
          if (d.gates) {
            setGates({
              webmail: d.gates.webmail !== false,
              gibberish: d.gates.gibberish !== false,
              blacklist: d.gates.blacklist !== false,
            });
          }
        }
      );
  }, []);

  const systemPreview = useMemo(() => {
    const op = addendum.trim() || "(none)";
    return [...DEFAULT_SYSTEM_LINES, { tone: "muted" as const, text: "# Operator rules" }, { tone: "body" as const, text: op }];
  }, [addendum]);

  const activeGates = Object.values(gates).filter(Boolean).length;

  async function save() {
    await fetch("/api/settings/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addendum, hitl: hitl / 100, gates }),
    });
    writeOnboarding({ ...readOnboarding(), scoring: true });
    setSaved(true);
  }

  async function runTest() {
    setRunning(true);
    setResult(null);
    const t0 = performance.now();
    try {
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        throw new Error("Invalid JSON payload");
      }
      const body = flattenIngestBody(raw);
      const res = await fetch("/api/leads/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lead: {
        score: number;
        tier: string;
        confidence: number;
        reasoning?: string;
        classification?: string;
      } | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!line) continue;
          const event = JSON.parse(line) as {
            type: string;
            lead?: {
              score: number;
              tier: string;
              confidence: number;
              reasoning?: string;
              classification?: string;
            };
            message?: string;
          };
          if (event.type === "result" && event.lead) lead = event.lead;
          if (event.type === "error") throw new Error(event.message ?? "Eval failed");
        }
      }
      if (lead) {
        setResult({
          score: lead.score,
          tier: lead.tier,
          confidence: lead.confidence,
          reasoning: lead.reasoning,
          classification: lead.classification,
          latencyMs: Math.round(performance.now() - t0),
        });
      }
    } catch (err) {
      setResult({
        score: 0,
        tier: "error",
        confidence: 0,
        latencyMs: Math.round(performance.now() - t0),
        reasoning: err instanceof Error ? err.message : "Eval failed",
      });
    } finally {
      setRunning(false);
    }
  }

  const tierLabel =
    result?.tier === "hot"
      ? "HOT LEAD"
      : result?.tier === "warm"
        ? "WARM NURTURE"
        : result?.tier === "error"
          ? "ERROR"
          : result
            ? result.tier.toUpperCase()
            : null;

  const routingLine =
    result?.tier === "hot"
      ? "Instant Route to Executive SDR"
      : result?.tier === "warm"
        ? "Nurture → Mid-Market Queue"
        : result?.tier === "error"
          ? "Evaluation failed"
          : result
            ? "Cold / review path"
            : null;

  // Approximate breakdown display from score (honest: proportional to weights)
  const breakdown = result
    ? WEIGHTS.map((w) => {
        const earned = Math.round((result.score / 100) * w.pct);
        const fill = Math.min(100, Math.round((earned / w.pct) * 100));
        return { ...w, earned, fill };
      })
    : [];

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      {/* Telemetry header */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-5 shadow-xl">
        <div className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-primary-container/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 -bottom-20 size-80 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
              <span className="text-outline">Configuration</span>
              <span className="text-outline-variant">/</span>
              <span className="font-semibold text-secondary">Inference Engine</span>
              <span className="text-outline-variant">/</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-2 py-0.5 text-tertiary">
                <span className="size-1.5 animate-ping rounded-full bg-tertiary" />
                v2.4 (Active)
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                Prompt Studio &amp; Scoring Engine
              </h1>
              <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-secondary">
                PRODUCTION-RELAXED
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs text-on-surface">
              <span className="material-symbols-outlined text-[16px] text-secondary">alt_route</span>
              <span className="font-mono font-medium">v2.4-production</span>
              <span className="font-mono text-[10px] text-on-surface-variant">(live)</span>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs font-semibold text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">bookmark_border</span>
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => void save()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary-container shadow-[0_0_20px_rgba(6,182,212,0.45)]"
            >
              <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              Deploy to Production
            </button>
          </div>
        </div>

        {saved ? (
          <p className="relative z-10 mt-3 text-xs text-tertiary">Saved. Next classify uses these rules.</p>
        ) : null}

        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            {
              label: "Active LLM Model",
              value: "Claude 3.5 Sonnet",
              icon: "neurology",
              tone: "text-primary",
              chip: "when keyed",
            },
            {
              label: "HITL Gate",
              value: `${hitl}%`,
              icon: "speed",
              tone: "text-tertiary",
              chip: "confidence",
            },
            {
              label: "Sampling Temp",
              value: temp.toFixed(2),
              icon: "verified",
              tone: "text-on-surface",
              chip: "deterministic",
            },
            {
              label: "Gates Active",
              value: `${activeGates}/3`,
              icon: "stacked_line_chart",
              tone: "text-secondary",
              chip: "UI preview",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center justify-between rounded-lg bg-surface-container px-3 py-2 shadow-sm"
            >
              <div>
                <p className="font-mono text-[10px] tracking-widest text-outline uppercase">{kpi.label}</p>
                <p className={cn("mt-0.5 flex items-center gap-1.5 font-mono text-xs font-semibold", kpi.tone)}>
                  <span className={cn("material-symbols-outlined text-[16px]", kpi.tone)}>{kpi.icon}</span>
                  {kpi.value}
                </p>
              </div>
              <span className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
                {kpi.chip}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3-column studio */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-4">
          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
                <h2 className="text-sm font-semibold text-on-surface">Model Architecture</h2>
              </div>
              <span className="rounded-full bg-secondary/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-secondary uppercase">
                Anthropic API
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-wider text-outline uppercase">
                  Core Foundation Model
                </label>
                <div className="mt-1 flex items-center justify-between rounded-lg bg-surface-container p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-tertiary" />
                    <span className="font-mono text-xs font-medium text-on-surface">
                      claude-3-5-sonnet · structured JSON
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-outline">unfold_more</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="tracking-wider text-outline uppercase">Sampling Temperature</span>
                  <span className="font-semibold text-secondary">
                    {temp.toFixed(2)} ({temp <= 0.25 ? "Deterministic" : "Creative"})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-500"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-outline-variant">
                  <span>0.0 Strict Grounding</span>
                  <span>1.0 High Creativity</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 rounded-lg bg-surface-container p-2.5">
                  <span className="block font-mono text-[10px] tracking-wider text-outline uppercase">
                    Max Output Tokens
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-on-surface">1,024 tok</span>
                    <span className="material-symbols-outlined text-[14px] text-outline">memory</span>
                  </div>
                </div>
                <div className="space-y-1 rounded-lg bg-surface-container p-2.5">
                  <span className="block font-mono text-[10px] tracking-wider text-outline uppercase">
                    Structured Mode
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-tertiary">JSON Schema</span>
                    <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">balance</span>
                <h2 className="text-sm font-semibold text-on-surface">Scoring Weights Matrix</h2>
              </div>
              <span className="rounded bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
                Total: 100%
              </span>
            </div>
            <p className="pb-3 text-xs text-on-surface-variant">
              Heuristic constraints enforced before evaluating unstructured signals.
            </p>
            <div className="space-y-2">
              {WEIGHTS.map((w) => (
                <div key={w.label} className="space-y-1 rounded-lg bg-surface-container p-2.5">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="flex items-center gap-1.5 font-medium text-on-surface">
                      <span className="size-2 rounded-full" style={{ background: w.color }} />
                      {w.label}
                    </span>
                    <span className="font-semibold" style={{ color: w.color }}>
                      {w.pct}% ({w.pct} pts)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                    <div className="h-full rounded-full" style={{ width: `${w.pct}%`, background: w.color }} />
                  </div>
                  <span className="font-mono text-[10px] text-outline">{w.hint}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-error">shield</span>
                <h2 className="text-sm font-semibold text-on-surface">Hard Disqualification Gates</h2>
              </div>
              <span className="font-mono text-[10px] text-tertiary">{activeGates} Active</span>
            </div>
            <div className="space-y-1.5">
              {(
                [
                  ["webmail", "Filter Free Webmail", "Reject @gmail, @outlook, @proton automatically"],
                  ["gibberish", "Block Gibberish / Entropy Drop", "N-gram entropy analyzer threshold < 2.4"],
                  ["blacklist", "Spam & Guest Post Blacklist", "Zero score on keywords: backlinks, crypto, outreach"],
                ] as const
              ).map(([key, label, hint]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-surface-container p-2.5">
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-medium text-on-surface">{label}</p>
                    <p className="truncate font-mono text-[10px] text-outline">{hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gates[key]}
                    onClick={() => setGates((g) => ({ ...g, [key]: !g[key] }))}
                    className={cn(
                      "flex h-5 w-9 items-center rounded-full p-0.5 transition",
                      gates[key] ? "justify-end bg-primary-container" : "justify-start bg-surface-container-highest"
                    )}
                  >
                    <span className="size-4 rounded-full bg-surface-container-lowest" />
                  </button>
                </div>
              ))}
            </div>
            <label className="mt-4 block font-mono text-[10px] text-on-surface-variant">
              HITL confidence gate · {hitl}%
              <input
                type="range"
                min={50}
                max={95}
                value={hitl}
                onChange={(e) => setHitl(Number(e.target.value))}
                className="mt-1 w-full accent-cyan-500"
              />
            </label>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-4">
          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-xl">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">code</span>
                <span className="text-sm font-semibold text-on-surface">System Instructions</span>
              </div>
              <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
                operator addendum editable
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto bg-surface-container-lowest/70 px-4 py-2">
              <span className="mr-1 font-mono text-[10px] tracking-wider text-outline uppercase">Insert:</span>
              {["{{lead.email}}", "{{enrichment.clearbit}}", "{{ip.asn_org}}", "{{lead.notes}}"].map((chip, i) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAddendum((a) => `${a}${a ? "\n" : ""}${chip}`)}
                  className={cn(
                    "rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] transition hover:bg-surface-container-high",
                    i === 0 ? "text-primary" : i === 1 ? "text-secondary" : i === 2 ? "text-tertiary" : "text-on-surface-variant"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="max-h-56 overflow-auto bg-surface-container-lowest p-4 font-mono text-[11px] leading-relaxed">
              <div className="flex gap-3">
                <div className="select-none space-y-1 pr-2 text-right text-[10px] text-outline-variant">
                  {systemPreview.map((_, i) => (
                    <div key={i}>{String(i + 1).padStart(2, "0")}</div>
                  ))}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-outline">
                  {systemPreview.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        line.tone === "primary" && "font-semibold text-primary",
                        line.tone === "muted" && "text-outline-variant",
                        line.tone === "body" && "text-on-surface-variant"
                      )}
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-outline-variant/20 p-4">
              <label className="block text-[11px] font-semibold text-on-surface-variant">
                Operator addendum
                <textarea
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
                  value={addendum}
                  onChange={(e) => setAddendum(e.target.value)}
                  placeholder="If the lead says they are a student, classify as spam."
                />
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-xl">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">schema</span>
                <span className="text-sm font-semibold text-on-surface">Strict JSON Schema Output</span>
              </div>
              <span className="flex items-center gap-1 font-mono text-[10px] text-tertiary">
                <span className="size-1.5 rounded-full bg-tertiary" />
                Enforced Strict
              </span>
            </div>
            <pre className="overflow-x-auto bg-surface-container-lowest p-4 font-mono text-[11px] leading-relaxed text-on-surface-variant">
              <code>{`{
  "type": "object",
  "required": ["score", "tier", "reasoning", "breakdown"],
  "properties": {
    "score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "tier": { "type": "string", "enum": ["HOT_LEAD", "WARM_NURTURE", "DISQUALIFIED"] },
    "reasoning": { "type": "string" },
    "breakdown": {
      "icp_fit": { "type": "number" },
      "budget_authority": { "type": "number" },
      "timeline": { "type": "number" }
    }
  }
}`}</code>
            </pre>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-4">
          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-tertiary">play_circle</span>
                <h2 className="text-sm font-semibold text-on-surface">Test Inbound Payload</h2>
              </div>
              <div className="flex items-center gap-1 rounded bg-surface-container px-2 py-1 font-mono text-[10px] text-on-surface">
                <span className="font-medium text-secondary">Enterprise Inbound</span>
                <span className="material-symbols-outlined text-[14px] text-outline">unfold_more</span>
              </div>
            </div>
            <textarea
              className="my-1 h-48 w-full resize-none rounded-lg bg-surface-container-lowest p-3 font-mono text-[11px] leading-relaxed text-on-surface-variant outline-none focus:ring-1 focus:ring-primary"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
            />
            <button
              type="button"
              disabled={running}
              onClick={() => void runTest()}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-secondary text-xs font-bold text-on-secondary shadow-[0_0_20px_rgba(6,182,212,0.35)] transition active:scale-[0.99] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              {running ? "Running…" : "Run Evaluation Test"}
              <span className="ml-1 rounded bg-on-secondary/15 px-1.5 py-0.5 font-mono text-[10px] opacity-75">
                ⌘ + Enter
              </span>
            </button>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-tertiary">group</span>
                <h2 className="text-sm font-semibold text-on-surface">Inference Result</h2>
              </div>
              {result ? (
                <div className="flex items-center gap-1 rounded-full bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
                  <span className="size-1.5 rounded-full bg-tertiary" />
                  Evaluation Complete
                </div>
              ) : (
                <span className="font-mono text-[10px] text-outline">Awaiting run</span>
              )}
            </div>

            {result ? (
              <>
                <div className="my-2 flex items-center gap-4 rounded-xl bg-surface-container p-4">
                  <div className="relative flex size-20 shrink-0 items-center justify-center">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-surface-container-highest"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <path
                        className="text-tertiary"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${Math.min(100, result.score)}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      />
                    </svg>
                    <span className="absolute text-2xl font-bold tracking-tight text-on-surface">
                      {result.score}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-tertiary/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-tertiary uppercase">
                        {tierLabel}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant">
                        {result.classification ?? "lead"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-on-surface">{routingLine}</p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                      {result.reasoning ?? "Live ingest evaluation from desk engine."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 py-3 text-center">
                  <div className="rounded bg-surface-container p-1.5">
                    <span className="block font-mono text-[10px] text-outline uppercase">Latency</span>
                    <span className="font-mono text-xs font-semibold text-tertiary">{result.latencyMs}ms</span>
                  </div>
                  <div className="rounded bg-surface-container p-1.5">
                    <span className="block font-mono text-[10px] text-outline uppercase">Cost</span>
                    <span className="font-mono text-xs font-semibold text-secondary">live API</span>
                  </div>
                  <div className="rounded bg-surface-container p-1.5">
                    <span className="block font-mono text-[10px] text-outline uppercase">Confidence</span>
                    <span className="font-mono text-xs font-semibold text-on-surface">
                      {Math.round(result.confidence * 1000) / 10}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {breakdown.map((b) => (
                    <div key={b.label} className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-on-surface-variant">{b.label}</span>
                        <span className="font-medium" style={{ color: b.color }}>
                          {b.earned} / {b.pct} pts ({b.fill}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${b.fill}%`, background: b.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-1 rounded-lg bg-surface-container-lowest p-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
                      Sanitized JSON Result
                    </span>
                  </div>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-tertiary">
                    <code>{JSON.stringify(
                      {
                        score: result.score,
                        tier: result.tier,
                        classification: result.classification,
                        confidence: result.confidence,
                        reasoning: result.reasoning,
                      },
                      null,
                      2
                    )}</code>
                  </pre>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-outline">Run a test to see score gauge.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
