"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirmClient, FirmKnowledge, FirmMatter } from "@/lib/conflict-types";
import { PRACTICE_AREAS, type NoBidRule, type PracticeArea, type PricingBook, type PricingRule } from "@/lib/pricing-types";

export default function FirmBookPage() {
  const [knowledge, setKnowledge] = useState<FirmKnowledge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState("Corporate");
  const [addingClient, setAddingClient] = useState(false);
  const [matterDraft, setMatterDraft] = useState<Record<string, { matterName: string; opposingParty: string; matterType: string }>>({});
  const [addingMatterFor, setAddingMatterFor] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/firm-clients");
    const data = (await res.json()) as FirmKnowledge;
    setKnowledge(data);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addClient() {
    if (!newClientName.trim()) return;
    setAddingClient(true);
    setError(null);
    try {
      const res = await fetch("/api/firm-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: newClientName, clientType: newClientType, status: "Active" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not add client");
        return;
      }
      setNewClientName("");
      await refresh();
    } finally {
      setAddingClient(false);
    }
  }

  async function addMatter(clientId: string) {
    const draft = matterDraft[clientId];
    if (!draft?.matterName.trim()) return;
    setAddingMatterFor(clientId);
    setError(null);
    try {
      const res = await fetch("/api/firm-matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          matterName: draft.matterName,
          opposingParty: draft.opposingParty,
          matterType: draft.matterType,
          status: "Active",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not add matter");
        return;
      }
      setMatterDraft((prev) => ({ ...prev, [clientId]: { matterName: "", opposingParty: "", matterType: "" } }));
      await refresh();
    } finally {
      setAddingMatterFor(null);
    }
  }

  async function removeClient(id: string) {
    if (!confirm("Remove this client and its matters from COI checks?")) return;
    await fetch(`/api/firm-clients/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function removeMatter(id: string) {
    await fetch(`/api/firm-matters/${id}`, { method: "DELETE" });
    await refresh();
  }

  const mattersByClient = (clientId: string): FirmMatter[] =>
    knowledge?.matters.filter((m) => m.clientId === clientId) ?? [];

  return (
    <>
      <FirmBookInner
        knowledge={knowledge}
        error={error}
        newClientName={newClientName}
        setNewClientName={setNewClientName}
        newClientType={newClientType}
        setNewClientType={setNewClientType}
        addingClient={addingClient}
        addClient={addClient}
        matterDraft={matterDraft}
        setMatterDraft={setMatterDraft}
        addingMatterFor={addingMatterFor}
        addMatter={addMatter}
        removeClient={removeClient}
        removeMatter={removeMatter}
        mattersByClient={mattersByClient}
      />
      <PricingRulesSection />
      <NoBidRulesSection />
    </>
  );
}

function PricingRulesSection() {
  const [book, setBook] = useState<PricingBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [practiceArea, setPracticeArea] = useState<PracticeArea>(PRACTICE_AREAS[0]);
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [avgRate, setAvgRate] = useState("");
  const [jurisdiction, setJurisdiction] = useState("US");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const res = await fetch("/api/pricing-rules");
    setBook((await res.json()) as PricingBook);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addRule() {
    const min = Number(minRate);
    const max = Number(maxRate);
    const avg = Number(avgRate);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(avg)) {
      setError("minRate, maxRate, avgRate must be numbers");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceArea, minRate: min, maxRate: max, avgRate: avg, jurisdiction }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not add pricing rule");
        return;
      }
      setMinRate("");
      setMaxRate("");
      setAvgRate("");
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function removeRule(id: string) {
    await fetch(`/api/pricing-rules/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 pb-7 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-white">Pricing rules</h2>
          <p className="mt-1 text-sm text-slate-400">Rate bands per practice area, used to price proposals.</p>
        </div>
        <Badge variant={book?.source === "supabase" ? "default" : "outline"}>
          {book?.source === "supabase" ? "Live (Supabase)" : "Demo (in-memory)"}
        </Badge>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Add rate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-2">
          <select
            value={practiceArea}
            onChange={(e) => setPracticeArea(e.target.value as PracticeArea)}
            className="h-9 rounded-md border border-white/10 bg-navy-900 px-2 text-sm text-white"
          >
            {PRACTICE_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          <input
            value={minRate}
            onChange={(e) => setMinRate(e.target.value)}
            placeholder="Min $/hr"
            className="h-9 w-24 rounded-md border border-white/10 bg-navy-900 px-2 text-sm text-white outline-none"
          />
          <input
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            placeholder="Max $/hr"
            className="h-9 w-24 rounded-md border border-white/10 bg-navy-900 px-2 text-sm text-white outline-none"
          />
          <input
            value={avgRate}
            onChange={(e) => setAvgRate(e.target.value)}
            placeholder="Avg $/hr"
            className="h-9 w-24 rounded-md border border-white/10 bg-navy-900 px-2 text-sm text-white outline-none"
          />
          <input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="Jurisdiction"
            className="h-9 w-28 rounded-md border border-white/10 bg-navy-900 px-2 text-sm text-white outline-none"
          />
          <Button disabled={adding} onClick={() => void addRule()}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(book?.rules ?? []).map((rule: PricingRule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded-md border border-white/5 bg-navy-950/40 px-3 py-2 text-sm"
          >
            <span className="text-slate-200">
              {rule.practiceArea} · ${rule.minRate}–${rule.maxRate}/hr (avg ${rule.avgRate}) · {rule.jurisdiction}
            </span>
            <button onClick={() => void removeRule(rule.id)} className="text-xs text-rose-400 hover:underline">
              Remove
            </button>
          </div>
        ))}
        {(book?.rules ?? []).length === 0 ? <p className="text-sm text-slate-500">No pricing rules yet.</p> : null}
      </div>
    </main>
  );
}

function NoBidRulesSection() {
  const [rules, setRules] = useState<NoBidRule[]>([]);
  const [source, setSource] = useState<"supabase" | "memory">("memory");
  const [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const res = await fetch("/api/no-bid-rules");
    const data = (await res.json()) as { rules: NoBidRule[]; source: "supabase" | "memory" };
    setRules(data.rules);
    setSource(data.source);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addRule() {
    if (!pattern.trim() || !reason.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/no-bid-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not add no-bid rule");
        return;
      }
      setPattern("");
      setReason("");
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    await fetch(`/api/no-bid-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  }

  async function removeRule(id: string) {
    await fetch(`/api/no-bid-rules/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 pb-10 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-white">No-bid rules</h2>
          <p className="mt-1 text-sm text-slate-400">
            Auto NO-GO patterns applied to every incoming RFP before partner review.
          </p>
        </div>
        <Badge variant={source === "supabase" ? "default" : "outline"}>
          {source === "supabase" ? "Live (Supabase)" : "Demo (in-memory)"}
        </Badge>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Add rule</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-2">
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Pattern (case-insensitive substring)"
            className="h-9 flex-1 rounded-md border border-white/10 bg-navy-900 px-3 text-sm text-white outline-none"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            className="h-9 flex-1 rounded-md border border-white/10 bg-navy-900 px-3 text-sm text-white outline-none"
          />
          <Button disabled={adding} onClick={() => void addRule()}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded-md border border-white/5 bg-navy-950/40 px-3 py-2 text-sm"
          >
            <div>
              <span className={rule.enabled ? "text-slate-200" : "text-slate-500 line-through"}>
                &quot;{rule.pattern}&quot;
              </span>
              <span className="ml-2 text-slate-400">— {rule.reason}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void toggleRule(rule.id, !rule.enabled)}
                className="text-xs text-sky-400 hover:underline"
              >
                {rule.enabled ? "Disable" : "Enable"}
              </button>
              <button onClick={() => void removeRule(rule.id)} className="text-xs text-rose-400 hover:underline">
                Remove
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 ? <p className="text-sm text-slate-500">No no-bid rules yet.</p> : null}
      </div>
    </main>
  );
}

function FirmBookInner({
  knowledge,
  error,
  newClientName,
  setNewClientName,
  newClientType,
  setNewClientType,
  addingClient,
  addClient,
  matterDraft,
  setMatterDraft,
  addingMatterFor,
  addMatter,
  removeClient,
  removeMatter,
  mattersByClient,
}: {
  knowledge: FirmKnowledge | null;
  error: string | null;
  newClientName: string;
  setNewClientName: (v: string) => void;
  newClientType: string;
  setNewClientType: (v: string) => void;
  addingClient: boolean;
  addClient: () => void;
  matterDraft: Record<string, { matterName: string; opposingParty: string; matterType: string }>;
  setMatterDraft: React.Dispatch<
    React.SetStateAction<Record<string, { matterName: string; opposingParty: string; matterType: string }>>
  >;
  addingMatterFor: string | null;
  addMatter: (clientId: string) => void;
  removeClient: (id: string) => void;
  removeMatter: (id: string) => void;
  mattersByClient: (clientId: string) => FirmMatter[];
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-7 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Firm book</h1>
          <p className="mt-1 text-sm text-slate-400">
            Real clients and matters COI checks run against — not the seeded demo list.
          </p>
        </div>
        <Badge variant={knowledge?.source === "supabase" ? "default" : "outline"}>
          {knowledge?.source === "supabase" ? "Live (Supabase)" : "Demo (in-memory)"}
        </Badge>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {knowledge?.source !== "supabase" ? (
        <Card>
          <CardContent className="pt-5 text-sm text-amber-300">
            Supabase isn&apos;t configured (or the firm_clients/firm_matters tables are empty) — showing
            the demo seed. Adding clients here requires Supabase to be configured in Settings.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Add client</CardTitle>
          <CardDescription>New entries feed real-time into the COI engine.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 pt-2">
          <input
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Client name"
            className="h-9 flex-1 rounded-md border border-white/10 bg-navy-900 px-3 text-sm text-white outline-none"
          />
          <select
            value={newClientType}
            onChange={(e) => setNewClientType(e.target.value)}
            className="h-9 rounded-md border border-white/10 bg-navy-900 px-2 text-sm text-white"
          >
            <option value="Corporate">Corporate</option>
            <option value="Individual">Individual</option>
            <option value="Government">Government</option>
          </select>
          <Button disabled={addingClient} onClick={() => void addClient()}>
            {addingClient ? "Adding…" : "Add"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(knowledge?.clients ?? []).map((client: FirmClient) => (
          <Card key={client.id}>
            <CardHeader className="flex-row items-center justify-between border-b border-white/5">
              <div>
                <CardTitle className="text-white">{client.clientName}</CardTitle>
                <CardDescription>
                  {client.clientType} · {client.status}
                </CardDescription>
              </div>
              <Button variant="ghost" onClick={() => void removeClient(client.id)}>
                Remove
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              {mattersByClient(client.id).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-navy-950/40 px-3 py-2"
                >
                  <span className="text-slate-200">
                    {m.matterName}
                    {m.opposingParty ? ` vs. ${m.opposingParty}` : ""}
                    {m.matterType ? ` · ${m.matterType}` : ""} · {m.status}
                  </span>
                  <button onClick={() => void removeMatter(m.id)} className="text-xs text-rose-400 hover:underline">
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <input
                  value={matterDraft[client.id]?.matterName ?? ""}
                  onChange={(e) =>
                    setMatterDraft((prev) => ({
                      ...prev,
                      [client.id]: { ...prev[client.id], matterName: e.target.value, opposingParty: prev[client.id]?.opposingParty ?? "", matterType: prev[client.id]?.matterType ?? "" },
                    }))
                  }
                  placeholder="New matter name"
                  className="h-8 flex-1 rounded-md border border-white/10 bg-navy-900 px-2 text-xs text-white outline-none"
                />
                <input
                  value={matterDraft[client.id]?.opposingParty ?? ""}
                  onChange={(e) =>
                    setMatterDraft((prev) => ({
                      ...prev,
                      [client.id]: { ...prev[client.id], opposingParty: e.target.value, matterName: prev[client.id]?.matterName ?? "", matterType: prev[client.id]?.matterType ?? "" },
                    }))
                  }
                  placeholder="Opposing party"
                  className="h-8 w-40 rounded-md border border-white/10 bg-navy-900 px-2 text-xs text-white outline-none"
                />
                <Button
                  variant="outline"
                  disabled={addingMatterFor === client.id}
                  onClick={() => void addMatter(client.id)}
                >
                  {addingMatterFor === client.id ? "…" : "Add matter"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(knowledge?.clients ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No clients yet.</p>
        ) : null}
      </div>
    </main>
  );
}
