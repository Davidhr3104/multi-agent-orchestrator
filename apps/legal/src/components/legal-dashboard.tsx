"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { PipelineLog, RfpStreamEvent, StoredRfp } from "@helix/core";
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
import { CalendarClock, Database, FileUp, Scale, ShieldAlert, Sparkles } from "lucide-react";

type Filter = "all" | "hot" | "warm" | "cold" | "review" | "BEAR" | "SPI" | "other";

function tierClass(tier: StoredRfp["tier"]) {
  if (tier === "hot") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (tier === "warm") return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
}

function rowAccent(rfp: StoredRfp) {
  if (rfp.tier === "hot") return "border-l-emerald-400";
  if (rfp.tier === "warm") return "border-l-amber-400";
  return "border-l-rose-400";
}

function daysUntil(deadline: string, now: number) {
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return null;
  return (t - now) / 86_400_000;
}

export function LegalDashboard() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoredRfp | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    issuer: "",
    body: "",
  });
  const [profile, setProfile] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/rfps");
    const data = (await res.json()) as { rfps: StoredRfp[]; clientProfile?: string };
    setRfps(data.rfps);
    if (data.clientProfile) setProfile(data.clientProfile);
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
    const avgMatch =
      rfps.length === 0
        ? 0
        : Math.round(rfps.reduce((s, r) => s + r.matchScore, 0) / rfps.length);
    const hotShare =
      rfps.length === 0 ? 0 : Math.round((rfps.filter((r) => r.tier === "hot").length / rfps.length) * 100);
    const close =
      nowMs === null
        ? 0
        : rfps.filter((r) => {
            const d = daysUntil(r.deadline, nowMs);
            return d != null && d >= 0 && d <= 14;
          }).length;
    const review = rfps.filter((r) => r.needsReview).length;
    return { avgMatch, hotShare, close, review };
  }, [rfps, nowMs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rfps.filter((rfp) => {
      if (filter === "review" && !rfp.needsReview) return false;
      if (filter === "hot" || filter === "warm" || filter === "cold") {
        if (rfp.tier !== filter) return false;
      }
      if (filter === "BEAR" || filter === "SPI" || filter === "other") {
        if (rfp.method !== filter) return false;
      }
      if (!q) return true;
      return [rfp.title, rfp.issuer, rfp.method, rfp.amount, rfp.deadline]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rfps, filter, query]);

  async function ingest(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch("/api/rfps/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, client_profile: profile }),
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
          const event = JSON.parse(line) as RfpStreamEvent;
          if (event.type === "log") setLogs((prev) => [...prev, event.log]);
          if (event.type === "result") {
            setRfps((prev) => [event.rfp, ...prev.filter((r) => r.id !== event.rfp.id)]);
            setSelected(event.rfp);
          }
          if (event.type === "error") setError(event.message);
        }
      }
      setForm({ title: "", issuer: "", body: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      void refresh();
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/settings/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_profile: profile }),
    });
    const data = (await res.json()) as { clientProfile?: string; error?: string };
    if (!res.ok) {
      setError(data.error || "Could not save profile");
      return;
    }
    if (data.clientProfile) setProfile(data.clientProfile);
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  }

  async function ingestPdf(file: File) {
    setPdfBusy(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.set("file", file);
      const res = await fetch("/api/rfps/extract", { method: "POST", body: payload });
      const data = (await res.json()) as { title?: string; body?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `PDF ${res.status}`);
      setForm((f) => ({
        ...f,
        title: f.title || data.title || f.title,
        body: data.body || f.body,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(false);
    }
  }

  async function askCorpus(id: string) {
    const res = await fetch(`/api/rfps/${id}/corpus`, { method: "POST" });
    const data = (await res.json()) as { rfp?: StoredRfp };
    if (data.rfp) {
      setRfps((prev) => prev.map((r) => (r.id === id ? data.rfp! : r)));
      setSelected(data.rfp);
    }
  }

  async function clearReview(id: string) {
    const res = await fetch(`/api/rfps/${id}/review`, { method: "POST" });
    const data = (await res.json()) as { rfp?: StoredRfp };
    if (data.rfp) {
      setRfps((prev) => prev.map((r) => (r.id === id ? data.rfp! : r)));
      setSelected(data.rfp);
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
    { id: "BEAR", label: "BEAR" },
    { id: "SPI", label: "SPI" },
    { id: "other", label: "Other method" },
  ];

  return (
    <div className="helix-grid min-h-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="h-[4.5rem] w-[min(100%,28rem)] overflow-hidden rounded-xl bg-white px-3 py-2 ring-1 ring-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/helix-for-legal.png"
                alt="Helix for Legal"
                className="h-full w-full object-cover object-[left_top] mix-blend-multiply"
              />
            </div>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              EXT extracts deadline, amount, and BEAR/SPI. FACT cites the exact span.
              REC scores fit against the editable client profile. Drop a PDF or paste text.
            </p>
          </div>
          <Badge variant="outline" className="h-auto border-primary/40 py-1 text-primary">
            MVP · navy + gold
          </Badge>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Scale className="size-4 text-primary" />}
            label="Hot share"
            value={`${metrics.hotShare}%`}
            hint="Match tier hot"
          />
          <Metric
            icon={<Sparkles className="size-4 text-primary" />}
            label="Avg match"
            value={String(metrics.avgMatch)}
            hint="Fit vs client profile"
          />
          <Metric
            icon={<CalendarClock className="size-4 text-primary" />}
            label="Due in 14d"
            value={String(metrics.close)}
            hint="Parsed deadlines"
          />
          <Metric
            icon={<ShieldAlert className="size-4 text-primary" />}
            label="Review queue"
            value={String(metrics.review)}
            hint="HITL required"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Opportunities</CardTitle>
              <CardDescription>
                Gold chrome matches the scales lockup. Green = hot fit, amber = warm, red = cold.
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
                placeholder="Filter title, issuer, method…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Title</th>
                      <th className="px-4 py-2 font-medium">Issuer</th>
                      <th className="px-4 py-2 font-medium">Method</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Match</th>
                      <th className="px-4 py-2 font-medium">Conf.</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((rfp) => (
                      <tr
                        key={rfp.id}
                        className={cn(
                          "border-b border-l-4 bg-card/40 hover:bg-muted/40",
                          rowAccent(rfp)
                        )}
                      >
                        <td className="px-4 py-2 font-medium">{rfp.title}</td>
                        <td className="px-4 py-2 text-muted-foreground">{rfp.issuer}</td>
                        <td className="px-4 py-2">{rfp.method}</td>
                        <td className="px-4 py-2">{rfp.amount}</td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs ring-1",
                              tierClass(rfp.tier)
                            )}
                          >
                            {rfp.matchScore} · {rfp.tier}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {Math.round(rfp.confidence * 100)}%
                          {rfp.needsReview ? (
                            <span className="ml-1 text-amber-300">HITL</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(rfp)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">
                    No RFPs in this filter.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="size-4 text-primary" />
                  Ingest RFP
                </CardTitle>
                <CardDescription>Drop a PDF or POST JSON to /api/rfps/ingest</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3" onSubmit={(e) => void ingest(e)}>
                  <label
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) void ingestPdf(file);
                    }}
                  >
                    <FileUp className="size-4 text-primary" />
                    {pdfBusy ? "Reading PDF…" : "Drop RFP PDF or click to upload"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void ingestPdf(file);
                      }}
                    />
                  </label>
                  <Field label="Title">
                    <Input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </Field>
                  <Field label="Issuer">
                    <Input
                      value={form.issuer}
                      onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                    />
                  </Field>
                  <Field label="RFP body">
                    <Textarea
                      required
                      rows={6}
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                    />
                  </Field>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" disabled={running}>
                    {running ? "Extracting…" : "Extract & match"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="size-4 text-primary" />
                  Client profile
                </CardTitle>
                <CardDescription>Match scoring uses this, not a hardcoded Fran profile.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3" onSubmit={(e) => void saveProfile(e)}>
                  <Textarea
                    rows={5}
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                  />
                  <Button type="submit" variant="secondary">
                    {profileSaved ? "Saved" : "Save profile"}
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
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {selected.issuer} · {selected.method} · engine {selected.engine}
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
                    {selected.matchScore} · {selected.tier}
                  </span>
                  <Badge variant="secondary">{selected.deadline}</Badge>
                  <Badge variant="outline">
                    {Math.round(selected.confidence * 100)}% confidence
                  </Badge>
                  <Badge variant="outline">{selected.unverifiedCount} unverified</Badge>
                  <Badge variant="outline">{selected.corpusStatus}</Badge>
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
                            {field.needsHuman ? " · FACT" : ""}
                          </span>
                        </div>
                        <p className="text-sm">{field.value}</p>
                        <p className="text-xs text-muted-foreground">{field.evidence}</p>
                        {field.quote ? (
                          <p className="mt-1 font-mono text-[11px] text-primary/90">
                            [{field.spanStart}:{field.spanEnd}] "{field.quote}"
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
                    Body
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
                </div>
              </div>
              <SheetFooter>
                {selected.needsReview ? (
                  <Button variant="secondary" onClick={() => void clearReview(selected.id)}>
                    Mark reviewed
                  </Button>
                ) : null}
                <Button onClick={() => void askCorpus(selected.id)}>
                  <Database className="size-4" />
                  Ask corpus
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
