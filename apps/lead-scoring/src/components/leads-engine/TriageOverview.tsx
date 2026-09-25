"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoredLead } from "@helix/core";
import { AttentionQueue } from "./AttentionQueue";
import { KpiStrip } from "./KpiStrip";
import { PriorityTable } from "./PriorityTable";
import { StreamChart } from "./StreamChart";
import { WebhookFeed } from "./WebhookFeed";
import { hotPct, ingestLeadStream, medianScore } from "./lead-ui";

export function TriageOverview() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as { leads?: StoredLead[] };
    setLeads(data.leads ?? []);
    setLoading(false);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  const simulateWebhook = useCallback(async () => {
    setSimBusy(true);
    try {
      const stamp = Date.now().toString(36).slice(-4);
      const lead = await ingestLeadStream(
        {
          name: `Webhook ${stamp}`,
          email: `webhook.${stamp}@inbound.test`,
          source: "webhook_sim",
          message: "Inbound form submission — evaluating Helix triage automation.",
          budget: "$10k",
          timeline: "this month",
          company: "Signal Co",
        },
        (msg) => setLogs((prev) => [...prev.slice(-20), msg])
      );
      if (lead) {
        setLeads((prev) => [lead, ...prev.filter((l) => l.id !== lead.id)]);
        showToast(`Simulated webhook → ${lead.name}`);
      }
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Simulate failed");
    } finally {
      setSimBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    function onRefresh() {
      void refresh();
    }
    function onNewLead() {
      void simulateWebhook();
    }
    function onOpenLead(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id) window.location.assign(`/leads/${id}/report`);
    }
    window.addEventListener("helix:leads-refresh", onRefresh);
    window.addEventListener("helix:new-lead", onNewLead);
    window.addEventListener("helix:open-lead", onOpenLead);
    return () => {
      window.removeEventListener("helix:leads-refresh", onRefresh);
      window.removeEventListener("helix:new-lead", onNewLead);
      window.removeEventListener("helix:open-lead", onOpenLead);
    };
  }, [refresh, simulateWebhook]);

  const kpis = useMemo(() => {
    const scores = leads.map((l) => l.score);
    return {
      ingested: leads.length,
      hotPercent: hotPct(leads),
      median: medianScore(scores),
      hitlPending: leads.filter((l) => l.needsReview).length,
    };
  }, [leads]);

  async function approveAndPush(id: string) {
    setBusyId(id);
    try {
      const crm = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
      const data = (await crm.json()) as { error?: string };
      if (!crm.ok) {
        showToast(data.error || "CRM push failed");
      } else {
        await fetch(`/api/leads/${id}/review`, { method: "POST" });
        showToast("Approved & pushed");
      }
      await refresh();
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } finally {
      setBusyId(null);
    }
  }

  async function markSpam(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}/archive`, { method: "POST" }).catch(() => null);
      let ok = Boolean(res?.ok);
      let label = "Archived";
      if (!ok) {
        // fallback: review clear only
        const reviewRes = await fetch(`/api/leads/${id}/review`, { method: "POST" }).catch(() => null);
        ok = Boolean(reviewRes?.ok);
        label = "Archive failed — HITL cleared instead";
        if (!ok) {
          const status = reviewRes ? reviewRes.status : res ? res.status : "network error";
          showToast(`Mark spam failed (${status}). Lead unchanged.`);
        }
      }
      if (ok) showToast(label);
      await refresh();
      if (ok) window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
              Autonomous Triage Overview
            </h1>
            <span className="rounded-full bg-tertiary-container/50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-tertiary uppercase">
              Engine · Production
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            Real-time telemetry from the seeded desk — probabilistic validation and CRM sync.
          </p>
        </div>
        <button
          type="button"
          disabled={simBusy}
          onClick={() => void simulateWebhook()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary-container shadow-[0_0_20px_rgba(6,182,212,0.35)] transition hover:brightness-110 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">bolt</span>
          {simBusy ? "Simulating…" : "Simulate Webhook"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-outline">Loading triage…</p>
      ) : (
        <>
          {kpis.hitlPending > 0 ? (
            <AttentionQueue
              leads={leads}
              busyId={busyId}
              onApprove={(id) => void approveAndPush(id)}
              onSpam={(id) => void markSpam(id)}
            />
          ) : (
            <div className="rounded-xl border border-outline-variant/25 bg-surface-container px-5 py-8 text-center">
              <p className="text-sm font-semibold text-on-surface">No leads pending review</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                The HITL queue is clear. Ingest a lead or check{" "}
                <a href="/settings" className="text-primary underline">Desk Settings</a> to load demo
                data.
              </p>
            </div>
          )}
          <KpiStrip {...kpis} />
          <StreamChart leads={leads} />
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PriorityTable leads={leads} />
            </div>
            <div className="lg:col-span-2">
              <WebhookFeed leads={leads} logs={logs} />
            </div>
          </div>
        </>
      )}

      {toast ? (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
