"use client";

import { useEffect, useState } from "react";
import type { CustomRule, UserPreferences } from "@/lib/types";

const EMPTY: CustomRule = {
  id: "",
  ifContains: "invoice",
  then: "route",
  enabled: true,
  minAmount: 1000,
  routeTo: "Finance",
  tagUrgent: true,
};

const ACTION: Record<CustomRule["then"], string> = {
  urgent: "mark it urgent",
  vip_route: "treat it as VIP",
  block: "block it",
  review: "send it to human review",
  route: "route it",
};

/** A rule as a sentence a person would say, instead of `If "1000" → urgent`. */
export function describeRule(rule: CustomRule): string {
  const phrase = rule.ifContains.trim();
  const amount = rule.minAmount ? `an amount of $${rule.minAmount.toLocaleString("en-US")} or more` : "";
  const when = phrase && amount ? `an email mentions "${phrase}" and ${amount}` : phrase ? `an email mentions "${phrase}"` : amount ? `an email mentions ${amount}` : "any email arrives";
  const dest = rule.then === "route" && rule.routeTo ? ` to ${rule.routeTo}` : rule.routeTo && rule.then !== "route" ? ` (${rule.routeTo})` : "";
  const extra = rule.tagUrgent && rule.then !== "urgent" ? " and tag it urgent" : "";
  return `When ${when}, ${ACTION[rule.then] ?? rule.then}${dest}${extra}.`;
}

export function RoutingRules() {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [draft, setDraft] = useState<CustomRule>({ ...EMPTY, id: "rule-new" });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/preferences")
      .then((r) => r.json())
      .then((d: { preferences?: UserPreferences }) => setRules(d.preferences?.customRules ?? []))
      .catch(() => setRules([]));
  }, []);

  async function save(next: CustomRule[]) {
    setRules(next);
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customRules: next }),
    });
    setStatus(res.ok ? "Rules saved. They apply on the next ingest." : "Could not save rules.");
  }

  return (
    <section className="glass-panel mb-6 min-w-0 rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Routing rules</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        If the mail contains a phrase and the amount is over the threshold, route it and optionally mark it urgent.
      </p>
      <ul className="mt-3 space-y-2">
        {rules.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
            <span className="min-w-0">{describeRule(rule)}</span>
            <button type="button" className="min-h-10 px-2 text-red-500 md:min-h-8" onClick={() => void save(rules.filter((r) => r.id !== rule.id))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <input
          value={draft.ifContains}
          onChange={(e) => setDraft({ ...draft, ifContains: e.target.value })}
          placeholder="Contains (optional)" aria-label="Email contains"
          className="min-h-10 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs md:min-h-8"
        />
        <input
          type="number"
          value={draft.minAmount ?? ""}
          onChange={(e) => setDraft({ ...draft, minAmount: Number(e.target.value) || undefined })}
          placeholder="Min amount ($)" aria-label="Minimum amount"
          className="min-h-10 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs md:min-h-8"
        />
        <input
          value={draft.routeTo ?? ""}
          onChange={(e) => setDraft({ ...draft, routeTo: e.target.value })}
          placeholder="Route to" aria-label="Route to"
          className="min-h-10 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs md:min-h-8"
        />
        <button
          type="button"
          className="min-h-10 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white md:min-h-8"
          onClick={() => {
            const next = [...rules, { ...draft, id: `rule-${Date.now()}`, then: "route" as const, enabled: true }];
            void save(next);
          }}
        >
          Add rule
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={Boolean(draft.tagUrgent)} onChange={(e) => setDraft({ ...draft, tagUrgent: e.target.checked })} />
        Tag URGENT
      </label>
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </section>
  );
}
