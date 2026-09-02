"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  LeadStreamEvent,
  PipelineLog,
  StoredLead,
} from "@helix/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Activity,
  Flame,
  Inbox,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

type Filter = "all" | "hot" | "warm" | "cold" | "review" | "spam" | "lead" | "info";

function tierClass(tier: StoredLead["tier"]) {
  if (tier === "hot") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (tier === "warm") return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
}

function rowAccent(lead: StoredLead) {
  if (lead.classification === "spam") return "border-l-rose-600";
  if (lead.tier === "hot") return "border-l-emerald-400";
  if (lead.tier === "warm") return "border-l-amber-400";
  return "border-l-rose-400";
}

function inboxAgeHours(iso: string, now: number) {
  return Math.max(0, (now - new Date(iso).getTime()) / 36e5);
}

export function LeadDashboard() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoredLead | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    source: "website",
    budget: "",
    timeline: "",
    message: "",
  });

  async function refresh() {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as { leads: StoredLead[] };
    setLeads(data.leads);
  }

  useEffect(() => {
    setMounted(true);
    void refresh();
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    const usable = leads.filter((l) => l.classification !== "spam");
    const inboxHealth =
      leads.length === 0 ? 0 : Math.round((usable.length / leads.length) * 100);
    const avgScore =
      usable.length === 0
        ? 0
        : Math.round(usable.reduce((s, l) => s + l.score, 0) / usable.length);
    const avgHours =
      usable.length === 0 || nowMs === null
        ? 0
        : usable.reduce((s, l) => s + inboxAgeHours(l.createdAt, nowMs), 0) /
          usable.length;
    const review = leads.filter((l) => l.needsReview).length;
    return { inboxHealth, avgScore, avgHours, review };
  }, [leads, nowMs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "review" && !lead.needsReview) return false;
      if (filter === "hot" || filter === "warm" || filter === "cold") {
        if (lead.tier !== filter) return false;
      }
      if (filter === "spam" || filter === "lead" || filter === "info") {
        if (lead.classification !== filter) return false;
      }
      if (!q) return true;
      return [lead.name, lead.email, lead.source, lead.classification]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, filter, query]);

  async function ingest(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch("/api/leads/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          const event = JSON.parse(line) as LeadStreamEvent;
          if (event.type === "log") setLogs((prev) => [...prev, event.log]);
          if (event.type === "result") {
            setLeads((prev) => [event.lead, ...prev.filter((l) => l.id !== event.lead.id)]);
            setSelected(event.lead);
          }
          if (event.type === "error") setError(event.message);
        }
      }
      setForm((f) => ({ ...f, name: "", email: "", message: "", budget: "", timeline: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      void refresh();
    }
  }

  async function sendCrm(id: string) {
    const res = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
    }
  }

  async function clearReview(id: string) {
    const res = await fetch(`/api/leads/${id}/review`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
    }
  }

  if (!mounted) {
    return <div className="helix-grid min-h-full" />;
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hot", label: "Hot" },
    { id: "warm", label: "Warm" },
    { id: "cold", label: "Cold" },
    { id: "review", label: "Needs review" },
    { id: "lead", label: "Leads" },
    { id: "info", label: "Info" },
    { id: "spam", label: "Spam" },
  ];

  return (
    <div className="helix-grid min-h-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.22em] text-primary uppercase">
              Helix template
            </p>
            <h1 className="font-heading mt-1 text-3xl font-medium">Lead Scoring</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              EXT extracts the contact, REC classifies and scores, REV flags mid-confidence
              cases. CRM handoff is mocked until GHL ships.
            </p>
          </div>
          <Badge variant="outline" className="h-auto py-1">
            MVP · no CRM API
          </Badge>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Inbox className="size-4" />}
            label="Inbox health"
            value={`${metrics.inboxHealth}%`}
            hint="Non-spam share"
          />
          <Metric
            icon={<Flame className="size-4" />}
            label="Lead quality"
            value={String(metrics.avgScore)}
            hint="Avg score excluding spam"
          />
          <Metric
            icon={<Activity className="size-4" />}
            label="Time in inbox"
            value={`${metrics.avgHours.toFixed(1)}h`}
            hint="Proxy for conversion time"
          />
          <Metric
            icon={<ShieldAlert className="size-4" />}
            label="Review queue"
            value={String(metrics.review)}
            hint="HITL required"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                Green = hot, amber = warm, red = cold or spam.
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.map((f) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant={filter === f.id ? "default" : "outline"}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <Input
                className="mt-3"
                placeholder="Filter name, email, source…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">Class</th>
                      <th className="px-4 py-2 font-medium">Score</th>
                      <th className="px-4 py-2 font-medium">Conf.</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((lead) => (
                      <tr
                        key={lead.id}
                        className={cn(
                          "border-b border-l-4 bg-card/40 hover:bg-muted/40",
                          rowAccent(lead)
                        )}
                      >
                        <td className="px-4 py-2 font-medium">{lead.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{lead.email}</td>
                        <td className="px-4 py-2">{lead.source}</td>
                        <td className="px-4 py-2">{lead.classification}</td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs ring-1",
                              tierClass(lead.tier)
                            )}
                          >
                            {lead.score} · {lead.tier}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {Math.round(lead.confidence * 100)}%
                          {lead.needsReview ? (
                            <span className="ml-1 text-amber-300">HITL</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(lead)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">No leads in this filter.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Ingest lead
                </CardTitle>
                <CardDescription>JSON POST to /api/leads/ingest</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3" onSubmit={(e) => void ingest(e)}>
                  <Field label="Name">
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Source">
                    <Input
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Budget">
                      <Input
                        value={form.budget}
                        onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      />
                    </Field>
                    <Field label="Timeline">
                      <Input
                        value={form.timeline}
                        onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Message">
                    <Textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                  </Field>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" disabled={running}>
                    {running ? "Scoring…" : "Classify & score"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="min-h-40">
              <CardHeader>
                <CardTitle>Live pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-40">
                  <ol className="space-y-1 font-mono text-[11px] text-muted-foreground">
                    {logs.map((log) => (
                      <li key={log.id}>
                        [{log.agent}] {log.message}
                      </li>
                    ))}
                    {logs.length === 0 ? <li>Waiting for ingest…</li> : null}
                  </ol>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.email} · {selected.source} · engine {selected.engine}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs ring-1",
                      tierClass(selected.tier)
                    )}
                  >
                    {selected.score} · {selected.tier}
                  </span>
                  <Badge variant="secondary">{selected.classification}</Badge>
                  <Badge variant="outline">
                    {Math.round(selected.confidence * 100)}% confidence
                  </Badge>
                  <Badge variant="outline">{selected.crmStatus}</Badge>
                </div>
                <p className="text-sm leading-relaxed">{selected.reasoning}</p>
                <div>
                  <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                    Scored fields
                  </p>
                  <ul className="space-y-2">
                    {selected.fields.map((field) => (
                      <li key={field.key} className="rounded-lg bg-muted/40 p-2">
                        <div className="flex justify-between text-sm">
                          <span>{field.label}</span>
                          <span className="text-muted-foreground">
                            {Math.round(field.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-sm">{field.value}</p>
                        <p className="text-xs text-muted-foreground">{field.evidence}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                {selected.message ? (
                  <div>
                    <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
                      Message
                    </p>
                    <p className="text-sm">{selected.message}</p>
                  </div>
                ) : null}
              </div>
              <SheetFooter>
                {selected.needsReview ? (
                  <Button variant="secondary" onClick={() => void clearReview(selected.id)}>
                    Mark reviewed
                  </Button>
                ) : null}
                <Button onClick={() => void sendCrm(selected.id)}>
                  <Send className="size-4" />
                  Send to CRM
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
