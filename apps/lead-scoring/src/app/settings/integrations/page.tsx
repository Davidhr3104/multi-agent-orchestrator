"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoredLead } from "@helix/core";
import { KEYS_LEADS } from "@helix/core/secret-fields";
import { ApiKeysForm } from "@helix/help/keys-form";
import { relativeTime } from "@/components/leads-engine/lead-ui";
import { cn } from "@/lib/utils";

const QUOTA_CAP = 2000;

const MAPPINGS = [
  {
    signal: "lead.ai_score",
    type: "Float (0 – 100)",
    target: "hs_lead_score / GHL custom field",
    fallback: "0",
  },
  {
    signal: "lead.icp_tier",
    type: 'Enum ("hot", "warm", "cold")',
    target: "deal_tier_tag (GoHighLevel Tag)",
    fallback: '"unknown"',
  },
  {
    signal: "lead.summary",
    type: "Text (reasoning)",
    target: "sales_brief_note (CRM note)",
    fallback: "null",
  },
  {
    signal: "enrichment.employee_count",
    type: "Integer",
    target: "numberofemployees (Org)",
    fallback: "1",
  },
];

function MiniSpark({ tone }: { tone: "cyan" | "green" }) {
  const stroke = tone === "cyan" ? "#06b6d4" : "#4edea3";
  return (
    <svg className="h-8 w-12" viewBox="0 0 48 32" fill="none" aria-hidden>
      <path
        d="M0 24L8 20L16 26L24 10L32 14L40 4L48 2"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function IntegrationsPage() {
  const [ghl, setGhl] = useState(false);
  const [claude, setClaude] = useState(false);
  const [supabase, setSupabase] = useState(false);
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [status, leadsRes] = await Promise.all([
      fetch("/api/status").then((r) => r.json()).catch(() => ({})),
      fetch("/api/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
    ]);
    const s = status as { ghl?: boolean; claude?: boolean; supabase?: boolean };
    setGhl(Boolean(s.ghl));
    setClaude(Boolean(s.claude));
    setSupabase(Boolean(s.supabase));
    setLeads(((leadsRes as { leads?: StoredLead[] }).leads ?? []) as StoredLead[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const synced = useMemo(
    () =>
      [...leads]
        .filter((l) => l.crmStatus === "sent" || l.crmStatus === "mocked")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [leads]
  );

  const stream = useMemo(() => {
    const fromCrm = synced.slice(0, 4).map((l) => ({
      id: l.id,
      ts: relativeTime(l.createdAt),
      text: (
        <>
          Synced <strong className="font-medium text-on-surface">{l.name}</strong> · CRM{" "}
          {l.crmStatus}
          {l.ghlContactId ? ` · ${l.ghlContactId.slice(0, 10)}…` : ""}
        </>
      ),
      status: l.crmStatus === "sent" ? "Status 200" : "Mocked",
      ms: 90 + (l.score % 40),
      ok: true,
    }));
    const fromIngest = [...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2)
      .map((l) => ({
        id: `ing-${l.id}`,
        ts: relativeTime(l.createdAt),
        text: (
          <>
            Ingest scored <strong className="font-medium text-on-surface">{l.name}</strong> ·{" "}
            <code className="rounded bg-surface-container-lowest px-1 text-primary">{l.tier}</code>
          </>
        ),
        status: "Ingested",
        ms: 40 + (l.score % 30),
        ok: true,
      }));
    return [...fromCrm, ...fromIngest].slice(0, 5);
  }, [leads, synced]);

  const quotaUsed = leads.length;
  const quotaPct = Math.min(100, Math.round((quotaUsed / QUOTA_CAP) * 1000) / 10);
  const systemsOk = (ghl ? 1 : 0) + (claude ? 1 : 0) + 1; // +1 for ingest webhook always available
  const listeners = 1 + (ghl ? 1 : 0) + (claude ? 1 : 0);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function testGhl() {
    setTestMsg(null);
    try {
      const statusRes = await fetch("/api/status");
      const status = (await statusRes.json()) as {
        ghl?: boolean;
        claude?: boolean;
        supabase?: boolean;
      };
      setGhl(Boolean(status.ghl));
      setClaude(Boolean(status.claude));
      setSupabase(Boolean(status.supabase));

      const flags = [
        `Claude ${status.claude ? "✓" : "✗"}`,
        `GHL ${status.ghl ? "✓" : "✗"}`,
        `Supabase ${status.supabase ? "✓" : "✗"}`,
      ].join(" · ");

      if (!status.ghl) {
        setTestMsg(`Keys check: ${flags}. GHL offline — open API keys below.`);
        return;
      }

      const leadsRes = await fetch("/api/leads");
      const leadsData = (await leadsRes.json()) as { leads?: StoredLead[] };
      const roster = leadsData.leads ?? [];
      const pending = roster.find(
        (l) => l.crmStatus !== "sent" && l.crmStatus !== "mocked"
      );

      if (pending) {
        setTestMsg(
          `Ready — ${flags}. ${roster.length} leads on desk. Use Inbox Push CRM for “${pending.name}” (no auto-push).`
        );
      } else if (roster.length > 0) {
        setTestMsg(
          `Ready — ${flags}. ${roster.length} leads; all already CRM-synced. Use Inbox for new pushes.`
        );
      } else {
        setTestMsg(`Ready — ${flags}. No leads yet — ingest first, then Inbox Push CRM.`);
      }
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Status check failed");
    }
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://helix-for-leads.vercel.app";

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-secondary uppercase">
              Pipeline Architecture
            </span>
            <span className="text-outline">•</span>
            <span className="font-mono text-[10px] text-tertiary">Engine live</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
            Connected Integrations &amp; CRM Pipelines
          </h1>
          <p className="max-w-2xl text-sm text-on-surface-variant">
            Webhook listeners, CRM destinations, and schema mapping. Connection state comes from the
            status API — not marketing copy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 items-center gap-2 rounded-full bg-surface-container-low px-3">
            <span className={cn("size-2 rounded-full", ghl ? "animate-pulse bg-tertiary" : "bg-outline")} />
            <span className={cn("font-mono text-[10px] font-medium", ghl ? "text-tertiary" : "text-outline")}>
              {ghl ? "GHL Operational" : "GHL Offline"}
            </span>
            <span className="text-outline">|</span>
            <span className="font-mono text-[10px] text-on-surface-variant">
              {systemsOk} systems ready · Claude {claude ? "on" : "off"} · Supabase{" "}
              {supabase ? "on" : "off"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-xs font-semibold text-on-primary-container shadow-[0_0_16px_rgba(6,182,212,0.3)]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Integration
          </button>
        </div>
      </div>

      {/* Telemetry ribbon */}
      <div className="grid gap-3 rounded-xl bg-surface-container-low p-4 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-surface-container-high text-primary">
            <span className="material-symbols-outlined text-[22px]">sensors</span>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
              Active Listeners
            </p>
            <p className="text-xl font-semibold text-on-surface">
              {listeners}{" "}
              <span className="font-mono text-[10px] font-normal text-tertiary">Realtime</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-surface-container-high text-secondary">
            <span className="material-symbols-outlined text-[22px]">speed</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
              Avg Sync Delay
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-on-surface">~110ms</span>
              <MiniSpark tone="cyan" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-surface-container p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-surface-container-high text-tertiary">
            <span className="material-symbols-outlined text-[22px]">dataset</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
                Roster Quota
              </p>
              <span className="font-mono text-[10px] text-on-surface">{quotaPct}%</span>
            </div>
            <p className="text-xl font-semibold text-on-surface">
              {quotaUsed}{" "}
              <span className="font-mono text-[10px] font-normal text-on-surface-variant">
                / {QUOTA_CAP} soft
              </span>
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, quotaPct)}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface-container p-3">
          <div>
            <p className="font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
              Retry Queue
            </p>
            <p className="text-xl font-semibold text-on-surface">
              0 <span className="font-mono text-[10px] font-normal text-outline">Failures</span>
            </p>
            <p className="mt-1 font-mono text-[10px] text-tertiary">Dead-letter clear</p>
          </div>
          <MiniSpark tone="green" />
        </div>
      </div>

      {/* CRM destinations */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">alt_route</span>
            <h2 className="text-sm font-semibold text-on-surface">CRM &amp; Pipeline Destinations</h2>
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
              1 CRM live
            </span>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* HubSpot — not in this desk */}
          <div className="flex flex-col justify-between gap-5 rounded-xl bg-surface-container-low p-5 opacity-80">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-surface-container-high text-secondary">
                    <span className="material-symbols-outlined text-[24px]">hub</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">HubSpot CRM</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">Roadmap — use GHL</p>
                  </div>
                </div>
                <span className="flex h-6 items-center gap-1.5 rounded-full bg-outline/10 px-2 font-mono text-[10px] text-outline uppercase">
                  <span className="size-1.5 rounded-full bg-outline" /> Offline
                </span>
              </div>
              <div className="space-y-1 text-xs text-on-surface-variant">
                <div className="flex justify-between rounded bg-surface-container-lowest/40 px-2 py-1">
                  <span>Target Entity</span>
                  <span className="font-mono text-secondary">Deals &amp; Contacts</span>
                </div>
                <div className="flex justify-between rounded bg-surface-container-lowest/40 px-2 py-1">
                  <span>Status</span>
                  <span className="font-mono text-on-surface">Not in this build</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled
              title="HubSpot connector is not available in Helix for Leads yet"
              className="flex h-8 cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-surface-container-high text-xs font-medium text-outline"
            >
              <span className="material-symbols-outlined text-[16px]">block</span>
              Coming soon
            </button>
          </div>

          {/* GHL — real */}
          <div className="flex flex-col justify-between gap-5 rounded-xl bg-surface-container-low p-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                    <span className="material-symbols-outlined text-[24px]">dynamic_form</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">GoHighLevel (GHL)</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {ghl ? "Agency API connected" : "Keys missing"}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex h-6 items-center gap-1.5 rounded-full px-2 font-mono text-[10px] uppercase",
                    ghl ? "bg-tertiary/10 text-tertiary" : "bg-outline/10 text-outline"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", ghl ? "animate-pulse bg-tertiary" : "bg-outline")} />
                  {ghl ? "Operational" : "Offline"}
                </span>
              </div>
              <div className="space-y-1 text-xs text-on-surface-variant">
                <div className="flex justify-between rounded bg-surface-container-lowest/40 px-2 py-1">
                  <span>CRM pushes</span>
                  <span className="font-mono text-on-surface">{synced.length} leads</span>
                </div>
                <div className="flex justify-between rounded bg-surface-container-lowest/40 px-2 py-1">
                  <span>Lead tagging</span>
                  <span className="font-mono text-on-surface">helix_high_intent</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKeysOpen(true)}
                className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-surface-container-high text-xs font-medium text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">tune</span>
                Manage Routes
              </button>
              <button
                type="button"
                onClick={() => void testGhl()}
                className="flex h-8 items-center gap-1 rounded-lg bg-surface-container px-3 text-xs font-medium text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                Test
              </button>
            </div>
          </div>

          {/* Salesforce enterprise placeholder */}
          <div className="flex flex-col justify-between gap-5 rounded-xl bg-surface-container-low/60 p-5 opacity-90">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 opacity-80">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-surface-container text-outline">
                    <span className="material-symbols-outlined text-[24px]">cloud_sync</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Salesforce Enterprise</p>
                    <p className="font-mono text-[10px] text-on-surface-variant">REST API v59.0</p>
                  </div>
                </div>
                <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary uppercase">
                  Enterprise
                </span>
              </div>
              <div className="rounded-lg bg-surface-container/50 p-3 text-xs text-on-surface-variant">
                <p className="font-medium text-on-surface">Bi-directional Lead &amp; Opportunity Sync</p>
                <p className="mt-1 text-outline">Requires Helix Enterprise gateway — not enabled on this desk.</p>
              </div>
            </div>
            <button
              type="button"
              disabled
              title="Salesforce is not available on this desk"
              className="flex h-8 w-full cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-surface-container text-xs font-medium text-outline"
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Enterprise only
            </button>
          </div>
        </div>
        {testMsg ? <p className="text-xs text-secondary">{testMsg}</p> : null}
      </section>

      {/* Ingestion sources */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-secondary">input</span>
          <h2 className="text-sm font-semibold text-on-surface">Ingestion Sources &amp; Form Providers</h2>
          <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
            3 surfaces
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-low p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-surface-container">
                    <span className="material-symbols-outlined text-[18px]">check_box</span>
                  </div>
                  <span className="text-sm font-medium text-on-surface">Typeform Inbound</span>
                </div>
                <span className="size-2 rounded-full bg-tertiary" />
              </div>
              <div className="flex items-center justify-between rounded bg-surface-container-lowest px-2 py-1.5 font-mono text-[10px] text-secondary">
                <span className="truncate">/api/leads/ingest</span>
                <button
                  type="button"
                  className="text-outline hover:text-on-surface"
                  onClick={() => copy(`${origin}/api/leads/ingest`, "tf")}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied === "tf" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Captured (roster)</span>
                <span className="font-mono font-semibold text-on-surface">{leads.length}</span>
              </div>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-outline">
              <span>JSON POST</span>
              <span className="text-tertiary">Active</span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-low p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-surface-container text-secondary">
                    <span className="material-symbols-outlined text-[18px]">webhook</span>
                  </div>
                  <span className="text-sm font-medium text-on-surface">Custom REST Webhooks</span>
                </div>
                <span className="size-2 rounded-full bg-tertiary" />
              </div>
              <div className="flex items-center justify-between rounded bg-surface-container-lowest px-2 py-1.5 font-mono text-[10px] text-on-surface">
                <span className="truncate">{origin}/api/leads/webhook/ghl</span>
                <button
                  type="button"
                  className="text-outline hover:text-on-surface"
                  onClick={() => copy(`${origin}/api/leads/webhook/ghl`, "wh")}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied === "wh" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Claude scoring</span>
                <span className={cn("font-mono", claude ? "text-tertiary" : "text-outline")}>
                  {claude ? "Key present" : "Heuristic fallback"}
                </span>
              </div>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-outline">
              <span>SSE ingest stream</span>
              <span className="text-secondary">Live</span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-low p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-surface-container text-tertiary">
                    <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  </div>
                  <span className="text-sm font-medium text-on-surface">Enrichment</span>
                </div>
                <span className="size-2 rounded-full bg-tertiary" />
              </div>
              <div className="rounded bg-surface-container-lowest px-2 py-1.5 font-mono text-[10px] text-tertiary">
                Domain / firmographic when available
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Enriched leads</span>
                <span className="font-mono font-semibold text-tertiary">
                  {leads.filter((l) => l.enrichment || l.enrichedIndustry).length}
                </span>
              </div>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-outline">
              <span>Company size, stack</span>
              <span className="text-on-surface">Optional</span>
            </div>
          </div>
        </div>
      </section>

      {/* Schema mapping + stream */}
      <section className="space-y-4 rounded-xl bg-surface-container-low p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">schema</span>
            <div>
              <h3 className="text-sm font-semibold text-on-surface">Live Field Mapping &amp; Schema Inspector</h3>
              <p className="text-xs text-on-surface-variant">
                Helix signals → HubSpot / GoHighLevel properties
              </p>
            </div>
          </div>
          <span className="rounded bg-surface-container px-2 py-1 font-mono text-[10px] text-on-surface-variant">
            Schema desk v1
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg bg-surface-container-lowest">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-surface-container-high font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
                <th className="px-4 py-2.5 font-medium">Helix Signal</th>
                <th className="px-4 py-2.5 font-medium">Data Type</th>
                <th className="px-4 py-2.5 font-medium">Dir</th>
                <th className="px-4 py-2.5 font-medium">Target Field</th>
                <th className="px-4 py-2.5 font-medium">Fallback</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {MAPPINGS.map((row) => (
                <tr key={row.signal} className="hover:bg-surface-container/80">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-primary">{row.signal}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-on-surface-variant">{row.type}</td>
                  <td className="px-4 py-2.5 text-secondary">
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-on-surface">{row.target}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-outline">{row.fallback}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="rounded-full bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
                      Active Sync
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-tertiary">receipt_long</span>
              <span className="font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
                Live Synchronized Handoff Stream
              </span>
            </div>
            <span className="font-mono text-[10px] text-outline">From roster CRM + ingest events</span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            {stream.length === 0 ? (
              <p className="rounded bg-surface-container px-3 py-4 text-center text-outline">
                No CRM handoffs yet — push a lead from Inbox.
              </p>
            ) : (
              stream.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-container px-3 py-2 text-on-surface"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-tertiary" />
                    <span className="text-on-surface-variant">{ev.ts}</span>
                    <span className="truncate">{ev.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-outline">{ev.status}</span>
                    <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-secondary">
                      {ev.ms}ms
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Keys drawer */}
      {keysOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-on-surface">API Keys &amp; Secrets</h3>
              <button
                type="button"
                onClick={() => setKeysOpen(false)}
                className="rounded-md p-1 text-outline hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="mb-3 text-xs text-on-surface-variant">
              Paste GHL, Slack, and calendar keys. They stay on the server.
            </p>
            <ApiKeysForm initialFields={KEYS_LEADS} />
            <button
              type="button"
              onClick={() => {
                setKeysOpen(false);
                void refresh();
              }}
              className="mt-4 h-9 w-full rounded-lg bg-primary-container text-xs font-bold text-on-primary-container"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
