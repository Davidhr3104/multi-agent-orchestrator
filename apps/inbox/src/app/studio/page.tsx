"use client";

import { useEffect, useState } from "react";
import { INBOX_MODELS, type InboxModelId, type InboxPersona } from "@/lib/agent-profile";

export default function StudioPage() {
  const [model, setModel] = useState<InboxModelId>("claude-sonnet-4-20250514");
  const [prompt, setPrompt] = useState("");
  const [persona, setPersona] = useState<InboxPersona>("executive");
  const [followUpHours, setFollowUpHours] = useState(48);
  const [quoteApprovalUsd, setQuoteApprovalUsd] = useState(5000);
  const [discountApprovalPct, setDiscountApprovalPct] = useState(15);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/studio")
      .then((r) => r.json())
      .then((d: { profile?: { model?: InboxModelId; prompt?: string; persona?: InboxPersona; followUpHours?: number; quoteApprovalUsd?: number; discountApprovalPct?: number } }) => {
        if (d.profile?.model) setModel(d.profile.model);
        if (d.profile?.prompt) setPrompt(d.profile.prompt);
        if (d.profile?.persona) setPersona(d.profile.persona);
        if (d.profile?.followUpHours) setFollowUpHours(d.profile.followUpHours);
        if (d.profile?.quoteApprovalUsd) setQuoteApprovalUsd(d.profile.quoteApprovalUsd);
        if (d.profile?.discountApprovalPct != null) setDiscountApprovalPct(d.profile.discountApprovalPct);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    const res = await fetch("/api/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, persona, followUpHours, quoteApprovalUsd, discountApprovalPct }),
    });
    setStatus(res.ok ? "Voice saved. New drafts use it." : "Could not save.");
    window.dispatchEvent(new CustomEvent("helix:model-changed"));
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-foreground">Prompt & agent studio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set the company voice and which Claude model drafts replies. Corrections in HITL stay in the audit log.
      </p>
      <label className="mt-6 block text-xs font-semibold text-muted-foreground uppercase">Desk</label>
      <select value={persona} onChange={(e) => setPersona(e.target.value as InboxPersona)} className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm">
        <option value="executive">Executive desk — formal tone, meetings, drop cold outreach</option>
        <option value="sales">Revenue Ops — buyer intent, match score, route to a seller</option>
      </select>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Follow-up wait (hours)
          <input type="number" min={1} value={followUpHours} onChange={(e) => setFollowUpHours(Number(e.target.value) || 48)} className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-normal normal-case" />
        </label>
        <label className="text-xs font-semibold text-muted-foreground uppercase">
          Human approval above (USD)
          <input type="number" min={0} value={quoteApprovalUsd} onChange={(e) => setQuoteApprovalUsd(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-normal normal-case" />
        </label>
      </div>
      <section className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-xs font-semibold tracking-wide text-red-700 uppercase dark:text-red-300">Hard rules</p>
        <p className="mt-1 text-xs text-muted-foreground">Ask Helix cannot send past these. A person presses Send.</p>
        <label className="mt-3 block text-xs font-semibold text-muted-foreground uppercase">
          Human approval for discounts above (%)
          <input type="number" min={0} max={100} value={discountApprovalPct} onChange={(e) => setDiscountApprovalPct(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-normal normal-case" />
        </label>
        <ul className="mt-3 space-y-1 text-xs text-foreground">
          <li>Quotes, contracts, and invoices at or above the USD line stay in review.</li>
          <li>A requested discount above {discountApprovalPct}% stays in review.</li>
        </ul>
      </section>
      <label className="mt-6 block text-xs font-semibold text-muted-foreground uppercase">Model</label>
      <select
        value={model}
        onChange={(e) => setModel(e.target.value as InboxModelId)}
        className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      >
        {INBOX_MODELS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <label className="mt-4 block text-xs font-semibold text-muted-foreground uppercase">Voice</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        placeholder="Short, calm, never promise a discount. Sign as the Northwind EA desk."
        className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      />
      <button type="button" className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" onClick={() => void save()}>
        Save voice
      </button>
      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
