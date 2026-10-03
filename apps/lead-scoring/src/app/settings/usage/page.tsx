"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StoredLead } from "@helix/core";
import { KEYS_LEADS } from "@helix/core/secret-fields";
import { ApiKeysForm } from "@helix/help/keys-form";
import { relativeTime, ingestLeadStream } from "@/components/leads-engine/lead-ui";
import { cn } from "@/lib/utils";
import type { AiCostSummary } from "@/lib/ai-cost";

type Usage = {
  ingestCount: number;
  heuristicCalls: number;
  claudeCalls: number;
  ghlCalls: number;
  hubspotCalls: number;
  claudeKey: boolean;
  ghlKey: boolean;
  hubspotKey: boolean;
  aiCost: AiCostSummary;
  models: { triage: string; draft: string };
};

function usd(n: number): string {
  if (n === 0) return "$0.00";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function claudeStatus(u: Usage | null): { label: string; live: boolean } {
  if (!u?.claudeKey) return { label: "Missing", live: false };
  const last = u.aiCost?.lastCall;
  if (!last) return { label: "Key set · no call yet", live: false };
  return last.ok ? { label: "Last call OK", live: true } : { label: "Last call failed", live: false };
}

type CodeLang = "curl" | "python" | "typescript" | "nodejs";

function buildSnippets(origin: string): Record<CodeLang, string> {
  const endpoint = `${origin}/api/leads/ingest`;
  return {
    curl: `# Ingest an unqualified lead payload
curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "first_name": "Jordan",
    "last_name": "Hayes",
    "email": "jordan@strataflow.io",
    "company": "Strataflow",
    "budget": 85000,
    "source": "inbound_webinar"
  }'`,
    python: `# Python — POST to Helix ingest
import requests

r = requests.post(
    "${endpoint}",
    json={
        "email": "jordan@strataflow.io",
        "first_name": "Jordan",
        "last_name": "Hayes",
        "budget": 85000,
        "source": "inbound_webinar",
    },
)
print(r.status_code, r.text[:200])`,
    typescript: `// TypeScript / ESM fetch
const res = await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "jordan@strataflow.io",
    company: "strataflow.io",
    source: "inbound_webinar",
  }),
});
// SSE stream of classify events — see /api/leads/ingest`,
    nodejs: `// Node.js native fetch
const res = await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "jordan@strataflow.io",
    budget: 85000,
  }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 200));`,
  };
}

export default function UsagePage() {
  const [u, setU] = useState<Usage | null>(null);
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [origin, setOrigin] = useState("https://helix-for-leads.vercel.app");
  const [lang, setLang] = useState<CodeLang>("curl");
  const [keysOpen, setKeysOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [streamCleared, setStreamCleared] = useState(false);
  const [simLogs, setSimLogs] = useState<
    { t: string; ok: boolean; ms: number; detail: string }[]
  >([]);

  const refresh = useCallback(async () => {
    const [usage, leadsRes] = await Promise.all([
      fetch("/api/usage").then((r) => r.json()).catch(() => null),
      fetch("/api/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
    ]);
    if (usage) setU(usage as Usage);
    setLeads(((leadsRes as { leads?: StoredLead[] }).leads ?? []) as StoredLead[]);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void refresh();
  }, [refresh]);

  const ingestUrl = `${origin}/api/leads/ingest`;
  const ghlWebhook = `${origin}/api/leads/webhook/ghl`;
  const snippets = useMemo(() => buildSnippets(origin), [origin]);

  const stream = useMemo(() => {
    if (streamCleared) return [];
    return [...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((l) => ({
        id: l.id.slice(0, 8),
        email: l.email,
        score: l.score,
        when: relativeTime(l.createdAt),
        tier: l.tier,
        spam: l.classification === "spam",
      }));
  }, [leads, streamCleared]);

  const pipes = useMemo(() => {
    const list = ["Ingest"];
    if (u?.ghlKey) list.push("GHL");
    if (u?.claudeKey) list.push("Claude");
    list.push("SSE");
    return list;
  }, [u]);

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    });
  }

  async function simulate() {
    const now = new Date();
    const t = now.toTimeString().slice(0, 8);
    const started = performance.now();
    const stamp = Date.now().toString(36).slice(-4);
    try {
      const lead = await ingestLeadStream({
        name: `Demo ${stamp}`,
        email: `demo.${stamp}@helix.test`,
        source: "webhook_simulator",
        message: "Usage page webhook simulator — demo ingest payload.",
        company: "Helix Demo Co",
        budget: "$15k",
        timeline: "this quarter",
      });
      const ms = Math.round(performance.now() - started);
      setSimLogs((prev) =>
        [
          {
            t,
            ok: Boolean(lead),
            ms,
            detail: lead
              ? `ok · ${lead.name} · score ${lead.score} · ${lead.tier}`
              : `ok · no lead payload returned`,
          },
          ...prev,
        ].slice(0, 5)
      );
      setStreamCleared(false);
      await refresh();
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      setSimLogs((prev) =>
        [
          {
            t,
            ok: false,
            ms,
            detail: err instanceof Error ? err.message : "ingest failed",
          },
          ...prev,
        ].slice(0, 5)
      );
    }
  }

  const quotaUsed = u?.ingestCount ?? 0;
  const quotaCap = 2000;
  const quotaPct = Math.min(100, Math.round((quotaUsed / quotaCap) * 1000) / 10);

  return (
    <main className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute -top-12 left-1/4 h-48 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute top-20 right-1/4 h-36 w-80 rounded-full bg-secondary/5 blur-3xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-secondary" />
            <span className="font-mono text-[10px] tracking-widest text-secondary uppercase">
              Developer Platform // REST & Streaming
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
            API Keys &amp; Ingestion Webhooks
          </h1>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Manage desk secrets, inbound ingest URLs, and session usage — counters restart with the
            process; no invented 1.4M request marketing quotas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/help"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs text-on-surface shadow-sm transition hover:bg-surface-bright"
          >
            <span className="material-symbols-outlined text-[16px] text-outline">description</span>
            API Reference
            <span className="material-symbols-outlined text-[14px] text-outline">north_east</span>
          </Link>
          <button
            type="button"
            onClick={() => void simulate()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs text-on-surface-variant shadow-sm transition hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">terminal</span>
            Webhook Simulator
          </button>
          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-xs font-semibold text-on-primary-container shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            Manage Keys
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between space-y-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
              Ingress API Status
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
              <span className="size-1.5 animate-pulse rounded-full bg-tertiary" />
              Live
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-on-surface">Online</span>
              <span className="font-mono text-[10px] text-tertiary">desk endpoint</span>
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
              <span>Session ingests</span>
              <span className="text-secondary">{u?.ingestCount ?? "—"}</span>
            </div>
          </div>
          <svg className="h-5 w-full text-tertiary" fill="none" viewBox="0 0 100 20" preserveAspectRatio="none">
            <path
              d="M0,14 L12,13 L24,15 L36,11 L48,12 L60,8 L72,10 L84,6 L92,7 L100,5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
        </div>

        <div className="flex flex-col justify-between space-y-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
              Session Quota
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
              {quotaPct}% of soft cap
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-on-surface">{quotaUsed}</span>
              <span className="font-mono text-[10px] text-outline">/ {quotaCap}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary-container" style={{ width: `${quotaPct}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
              <span>{Math.max(0, quotaCap - quotaUsed)} remaining</span>
              <span className="text-outline">in-memory</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
              Active Endpoints
            </span>
            <span className="material-symbols-outlined text-[18px] text-secondary">hub</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-on-surface">{pipes.length}</span>
              <span className="font-mono text-[10px] text-secondary">Pipes Online</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px]">
              {pipes.map((p) => (
                <span key={p} className="rounded bg-surface-container-high px-1.5 py-0.5 text-on-surface">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
              Security Enforcement
            </span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">verified_user</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-on-surface">Org webhook token</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-tertiary">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              GHL path scoped by URL token when org linked
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT */}
        <div className="space-y-6 xl:col-span-7">
          {/* Keys */}
          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded bg-primary/10">
                  <span className="material-symbols-outlined text-[20px] text-primary">key</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">Active Desk Secrets</h2>
                  <p className="font-mono text-[10px] text-on-surface-variant">
                    Claude + GHL keys — never shown in full; manage via encrypted store
                  </p>
                </div>
              </div>
              <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-[10px] text-outline">
                {[u?.claudeKey, u?.ghlKey].filter(Boolean).length} present
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-2 rounded-lg bg-surface-container p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        u?.claudeKey ? "bg-tertiary" : "bg-outline"
                      )}
                    />
                    <span className="text-sm font-medium text-on-surface">Anthropic / Claude</span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[10px]",
                        claudeStatus(u).live
                          ? "bg-tertiary-container/30 text-tertiary"
                          : "bg-surface-container-high text-on-surface-variant"
                      )}
                    >
                      {claudeStatus(u).label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeysOpen(true)}
                    className="flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 font-mono text-[10px] text-on-surface-variant transition hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[14px]">tune</span>
                    Configure
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded bg-surface-container-lowest p-2 font-mono text-[11px] text-secondary">
                  <span className="material-symbols-outlined text-[16px] text-outline">token</span>
                  <span className="tracking-wider">
                    {u?.claudeKey ? "sk-ant-••••••••••••••••" : "not configured"}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-outline">
                    {u?.claudeCalls ?? 0} calls this session
                  </span>
                </div>
                <p className="font-mono text-[10px] text-on-surface-variant">
                  Triage: {u?.models.triage ?? "—"} · Drafts: {u?.models.draft ?? "—"} · Heuristic
                  fallback when the key is missing or a call fails
                </p>
              </div>

              <div className="space-y-2 rounded-lg bg-surface-container p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("size-2 rounded-full", u?.ghlKey ? "bg-secondary" : "bg-outline")}
                    />
                    <span className="text-sm font-medium text-on-surface">GoHighLevel Agency</span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[10px]",
                        u?.ghlKey
                          ? "bg-secondary/15 text-secondary"
                          : "bg-surface-container-high text-on-surface-variant"
                      )}
                    >
                      {u?.ghlKey ? "Connected" : "Offline"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeysOpen(true)}
                    className="flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 font-mono text-[10px] text-on-surface-variant transition hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[14px]">tune</span>
                    Configure
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded bg-surface-container-lowest p-2 font-mono text-[11px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-outline">token</span>
                  <span className="tracking-wider">
                    {u?.ghlKey ? "ghl_••••••••••••••••" : "not configured"}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-outline">
                    {u?.ghlCalls ?? 0} CRM calls
                  </span>
                </div>
                <p className="font-mono text-[10px] text-on-surface-variant">
                  Scope: Contact + opportunity push · Mock when keys missing
                </p>
              </div>
            </div>
          </div>

          {/* Incoming */}
          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded bg-secondary/10">
                  <span className="material-symbols-outlined text-[20px] text-secondary">input</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">Incoming Ingestion Endpoint</h2>
                  <p className="font-mono text-[10px] text-on-surface-variant">
                    POST JSON or point GHL forms at the webhook path
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
                <span className="size-1.5 rounded-full bg-tertiary" />
                Listening
              </span>
            </div>
            <div className="space-y-4 p-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] tracking-wider text-outline uppercase">
                  Inbound REST Endpoint (HTTPS POST)
                </label>
                <div className="flex items-center overflow-hidden rounded bg-surface-container-lowest p-1.5">
                  <span className="mr-2 rounded bg-primary-container px-2 py-0.5 font-mono text-[10px] font-semibold text-on-primary-container">
                    POST
                  </span>
                  <span className="truncate font-mono text-[11px] text-on-surface">{ingestUrl}</span>
                  <button
                    type="button"
                    title="Copy endpoint URL"
                    onClick={() => copy(ingestUrl, "ingest")}
                    className="ml-auto rounded p-1 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copied === "ingest" ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] tracking-wider text-outline uppercase">
                  Public form / webhook intake (JSON or HTML form POST)
                </label>
                <div className="flex items-center overflow-hidden rounded bg-surface-container-lowest p-1.5">
                  <span className="mr-2 rounded bg-primary-container px-2 py-0.5 font-mono text-[10px] font-semibold text-on-primary-container">
                    POST
                  </span>
                  <span className="truncate font-mono text-[11px] text-on-surface">
                    {origin}/api/leads/intake/&lt;token&gt;
                  </span>
                </div>
                <p className="pt-0.5 font-mono text-[10px] text-outline">
                  Token = your org webhook token, or HELIX_INTAKE_TOKEN on a single-tenant deploy. Leads
                  are triaged on arrival and stored as real data; nothing is pushed to a CRM.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[10px] tracking-wider text-outline uppercase">
                    GHL Webhook Path
                  </label>
                  <span className="font-mono text-[10px] text-tertiary">Server-to-server</span>
                </div>
                <div className="flex items-center overflow-hidden rounded bg-surface-container-lowest p-1.5">
                  <span className="material-symbols-outlined mx-1 text-[16px] text-outline">
                    shield_lock
                  </span>
                  <span className="truncate pl-1 font-mono text-[11px] tracking-wide text-on-surface-variant">
                    {ghlWebhook}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(ghlWebhook, "ghl")}
                    className="ml-auto rounded px-2 py-0.5 font-mono text-[10px] text-on-surface-variant transition hover:bg-surface-container"
                  >
                    {copied === "ghl" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="pt-0.5 font-mono text-[10px] text-outline">
                  Org-scoped URLs use{" "}
                  <code className="rounded bg-surface-container px-1 py-0.5 text-secondary">
                    /api/leads/webhook/ghl/[token]
                  </code>
                </p>
              </div>
            </div>
          </div>

          {/* Outgoing */}
          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded bg-tertiary/10">
                  <span className="material-symbols-outlined text-[20px] text-tertiary">outbox</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">Outgoing Dispatch</h2>
                  <p className="font-mono text-[10px] text-on-surface-variant">
                    CRM sync & notification targets after qualification
                  </p>
                </div>
              </div>
              <Link
                href="/settings/integrations"
                className="flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface transition hover:bg-surface-bright"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Integrations
              </Link>
            </div>
            <div className="space-y-2 p-4">
              <div className="space-y-1 rounded-lg bg-surface-container p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("size-2 rounded-full", u?.ghlKey ? "bg-tertiary" : "bg-outline")}
                    />
                    <span className="text-sm font-medium text-on-surface">GoHighLevel CRM Pipe</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px]",
                        u?.ghlKey ? "bg-tertiary/15 text-tertiary" : "bg-outline/10 text-outline"
                      )}
                    >
                      {u?.ghlKey ? "Ready" : "Offline"}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-outline">
                    {u?.ghlCalls ?? 0} session calls
                  </span>
                </div>
                <div className="truncate rounded bg-surface-container-lowest p-2 font-mono text-[11px] text-secondary">
                  sendLeadToGhl · Agency API
                </div>
                <div className="flex justify-between pt-1 font-mono text-[10px] text-on-surface-variant">
                  <span>
                    Trigger: <span className="font-medium text-on-surface">HITL approve / hot push</span>
                  </span>
                  <span>
                    Backoff: <span className="font-medium text-on-surface">Operator retry</span>
                  </span>
                </div>
              </div>
              <div className="space-y-1 rounded-lg bg-surface-container p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-secondary" />
                    <span className="text-sm font-medium text-on-surface">Slack (optional)</span>
                    <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
                      Env hook
                    </span>
                  </div>
                </div>
                <div className="truncate rounded bg-surface-container-lowest p-2 font-mono text-[11px] text-secondary">
                  SLACK_WEBHOOK_URL when set
                </div>
                <div className="flex justify-between pt-1 font-mono text-[10px] text-on-surface-variant">
                  <span>
                    Trigger: <span className="font-medium text-on-surface">Hot leads / triage</span>
                  </span>
                  <span>
                    Rate: <span className="font-medium text-on-surface">Async</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6 xl:col-span-5">
          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center justify-between bg-surface-container px-4 py-2">
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {(["curl", "python", "typescript", "nodejs"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={cn(
                      "rounded px-2 py-1 font-medium capitalize transition",
                      lang === l
                        ? "bg-surface-container-high text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    {l === "nodejs" ? "Node.js" : l === "typescript" ? "TypeScript" : l === "python" ? "Python" : "cURL"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => copy(snippets[lang], "snip")}
                className="flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 font-mono text-[10px] text-on-surface-variant transition hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copied === "snip" ? "check" : "content_copy"}
                </span>
                Copy
              </button>
            </div>
            <pre className="min-h-[220px] overflow-x-auto bg-surface-container-lowest p-4 font-mono text-[11px] leading-relaxed whitespace-pre text-on-surface-variant">
              {snippets[lang]}
            </pre>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 animate-pulse rounded-full bg-secondary" />
                <span className="text-sm font-semibold text-on-surface">Live Ingress Stream</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-outline">Roster-backed</span>
                <button
                  type="button"
                  onClick={() => {
                    setStreamCleared(true);
                    setSimLogs([]);
                  }}
                  className="rounded bg-surface-container-high px-2 py-0.5 text-on-surface-variant transition hover:text-on-surface"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="h-64 space-y-2 overflow-y-auto bg-surface-container-lowest p-4 font-mono text-[11px]">
              {simLogs.map((s, i) => (
                <div key={`${s.t}-${i}`} className="border-t border-surface-container-high/40 pt-1">
                  <div className="flex items-start gap-2 text-on-surface-variant">
                    <span className="text-outline">[{s.t}]</span>
                    <span className="font-bold text-secondary">POST</span>
                    <span className="truncate text-on-surface">/api/leads/ingest</span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 font-semibold",
                        s.ok ? "text-tertiary" : "text-error"
                      )}
                    >
                      {s.ok ? "200 OK" : "FAIL"}
                    </span>
                    <span className="shrink-0 text-outline">{s.ms}ms</span>
                  </div>
                  <div className="pl-4 text-[10px] text-outline">{s.detail}</div>
                </div>
              ))}
              {stream.length === 0 && simLogs.length === 0 ? (
                <div className="py-2 text-outline italic">
                  Stream cleared. Waiting for inbound events…
                </div>
              ) : (
                stream.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-start gap-2 text-on-surface-variant">
                      <span className="text-outline">{s.when}</span>
                      <span className="font-bold text-secondary">POST</span>
                      <span className="truncate text-on-surface">/api/leads/ingest</span>
                      <span
                        className={cn(
                          "ml-auto shrink-0 font-semibold",
                          s.spam ? "text-error" : "text-tertiary"
                        )}
                      >
                        {s.spam ? "FILTERED" : "200 OK"}
                      </span>
                    </div>
                    <div className="pl-4 text-[10px] text-outline">
                      payload_id: <span className="text-on-surface-variant">{s.id}</span> · lead:{" "}
                      <span className="text-on-surface">{s.email}</span> · score:{" "}
                      <span className="font-bold text-tertiary">
                        {s.score}/100
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded bg-tertiary/10">
                <span className="material-symbols-outlined text-[20px] text-tertiary">task_alt</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-on-surface">Dead Letter Queue (DLQ)</span>
                  <span className="rounded-full bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
                    0 Items
                  </span>
                </div>
                <p className="font-mono text-[10px] text-on-surface-variant">
                  Failed CRM pushes surface on the lead · operator retry
                </p>
              </div>
            </div>
            <Link
              href="/audit"
              className="h-8 rounded bg-surface-container-high px-2 font-mono text-[10px] leading-8 text-on-surface transition hover:bg-surface-bright"
            >
              Inspect Audit
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded bg-primary/10">
                  <span className="material-symbols-outlined text-[20px] text-primary">payments</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">Claude cost (estimated)</h2>
                  <p className="font-mono text-[10px] text-on-surface-variant">
                    Tokens as reported by the Anthropic API × list prices in code. Not your invoice.
                  </p>
                </div>
              </div>
              <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-[10px] text-outline">
                estimate
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Claude calls", v: u ? String(u.aiCost.calls) : "—" },
                  { label: "Input tokens", v: u ? u.aiCost.inputTokens.toLocaleString() : "—" },
                  { label: "Output tokens", v: u ? u.aiCost.outputTokens.toLocaleString() : "—" },
                  { label: "Est. USD", v: u ? usd(u.aiCost.estimatedUsd) : "—" },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg bg-surface-container p-3">
                    <p className="font-mono text-[10px] text-outline">{c.label}</p>
                    <p className="mt-0.5 text-lg font-semibold text-on-surface">{c.v}</p>
                  </div>
                ))}
              </div>
              {u && u.aiCost.byModel.length > 0 ? (
                <ul className="space-y-1 font-mono text-[10px] text-on-surface-variant">
                  {u.aiCost.byModel.map((m) => (
                    <li key={m.model} className="flex justify-between rounded bg-surface-container-lowest px-2 py-1">
                      <span className="text-on-surface">{m.model}</span>
                      <span>
                        {m.calls} calls · {m.inputTokens.toLocaleString()} in /{" "}
                        {m.outputTokens.toLocaleString()} out · ~{usd(m.estimatedUsd)}
                        {m.priceKnown ? "" : " (price unknown, Sonnet rate assumed)"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-[10px] text-outline">
                  {u?.claudeKey
                    ? "No Claude calls recorded yet."
                    : "No ANTHROPIC_API_KEY: triage runs on the heuristic, which costs nothing."}
                </p>
              )}
              <p className="font-mono text-[10px] text-outline">
                {u?.aiCost.failedCalls ? `${u.aiCost.failedCalls} failed call(s) · ` : ""}
                Counted on this server instance since{" "}
                {u ? new Date(u.aiCost.since).toLocaleString() : "—"}; resets on restart/redeploy. Ask
                Helix AI chat calls are not included yet.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Ingests", v: u?.ingestCount },
              { label: "Heuristic", v: u?.heuristicCalls },
              { label: "Claude triage", v: u?.claudeCalls },
              { label: "HubSpot calls", v: u?.hubspotCalls },
            ].map((c) => (
              <div key={c.label} className="rounded-lg bg-surface-container p-3">
                <p className="font-mono text-[10px] text-outline">{c.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-on-surface">{c.v ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {keysOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-container-low p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface">Desk API Keys</h2>
              <button
                type="button"
                onClick={() => {
                  setKeysOpen(false);
                  void refresh();
                }}
                className="rounded p-1 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ApiKeysForm initialFields={KEYS_LEADS} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
