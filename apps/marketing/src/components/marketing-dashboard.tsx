"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { AttributedLead, StoredCampaign } from "@helix/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SAMPLE_CSV } from "@/lib/sample-csv";
import { cn } from "@/lib/utils";
import { Flame, Pause, ShieldAlert, TrendingUp, Wallet } from "lucide-react";

type Filter = "all" | "pause" | "scale" | "keep" | "review";

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function actionClass(action: StoredCampaign["action"]) {
  if (action === "pause") return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  if (action === "scale") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

export function MarketingDashboard() {
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [leads, setLeads] = useState<AttributedLead[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<StoredCampaign | null>(null);
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [mounted, setMounted] = useState(false);

  async function refresh() {
    const res = await fetch("/api/campaigns");
    const data = (await res.json()) as { campaigns: StoredCampaign[]; leads: AttributedLead[] };
    setCampaigns(data.campaigns);
    setLeads(data.leads);
  }

  useEffect(() => {
    setMounted(true);
    void refresh();
  }, []);

  const metrics = useMemo(() => {
    const spend = campaigns.reduce((s, c) => s + c.spend, 0);
    const avg =
      campaigns.length === 0
        ? 0
        : Math.round(campaigns.reduce((s, c) => s + c.metrics.avgScore, 0) / campaigns.length);
    const hotCost = campaigns
      .map((c) => c.metrics.costPerHot)
      .filter((n): n is number => n != null);
    const costPerHot =
      hotCost.length === 0 ? null : hotCost.reduce((s, n) => s + n, 0) / hotCost.length;
    const review = campaigns.filter((c) => c.needsReview).length;
    return { spend, avg, costPerHot, review };
  }, [campaigns]);

  const visible = useMemo(() => {
    return campaigns.filter((c) => {
      if (filter === "review") return c.needsReview;
      if (filter === "pause" || filter === "scale" || filter === "keep") return c.action === filter;
      return true;
    });
  }, [campaigns, filter]);

  async function ingest(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function review(id: string, action: "pause" | "scale" | "keep") {
    const res = await fetch(`/api/campaigns/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = (await res.json()) as { campaign?: StoredCampaign };
    if (data.campaign) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? data.campaign! : c)));
      setSelected(data.campaign);
      setNote("");
    }
  }

  if (!mounted) return <div className="helix-grid min-h-full" />;

  const related = selected
    ? leads.filter((l) => l.campaignId === selected.campaignId).slice(0, 12)
    : [];

  return (
    <div className="helix-grid min-h-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/helix-for-marketing.png"
                alt="Helix for Marketing"
                className="h-16 w-auto shrink-0"
              />
              <div>
                <p className="text-xs leading-none tracking-[0.2em] text-primary uppercase">
                  Helix for Marketing
                </p>
                <h1 className="font-heading mt-1 text-2xl leading-none font-medium">
                  Ads spend vs lead quality
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Join campaign spend to scored leads. REC suggests pause / scale / keep. A human
              confirms locally — Meta and Google stay disconnected this sprint.
            </p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            <Link href="/help" className="text-muted-foreground hover:text-foreground">
              How to use
            </Link>
          </nav>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Wallet className="size-4" />} label="Spend" value={money(metrics.spend)} hint="Seed + ingested CSV" />
          <Metric icon={<Flame className="size-4" />} label="Avg score" value={String(metrics.avg)} hint="Across campaigns" />
          <Metric
            icon={<TrendingUp className="size-4" />}
            label="Cost / hot"
            value={money(metrics.costPerHot)}
            hint="Mean of campaigns with hot leads"
          />
          <Metric icon={<ShieldAlert className="size-4" />} label="HITL queue" value={String(metrics.review)} hint="Needs a human call" />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Campaigns</CardTitle>
              <CardDescription>
                Ad A (120 forms, score ~24) should pause. Ad B (22 forms, score ~79) should scale.
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["all", "pause", "scale", "keep", "review"] as Filter[]).map((id) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={filter === id ? "default" : "outline"}
                    onClick={() => setFilter(id)}
                  >
                    {id}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Campaign</th>
                      <th className="px-4 py-2 font-medium">Spend</th>
                      <th className="px-4 py-2 font-medium">Forms</th>
                      <th className="px-4 py-2 font-medium">Avg score</th>
                      <th className="px-4 py-2 font-medium">$/hot</th>
                      <th className="px-4 py-2 font-medium">REC</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => (
                      <tr key={c.id} className="border-b bg-card/40 hover:bg-muted/40">
                        <td className="px-4 py-2">
                          <p className="font-medium">{c.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{c.campaignId}</p>
                        </td>
                        <td className="px-4 py-2">{money(c.spend)}</td>
                        <td className="px-4 py-2">{c.metrics.formLeads}</td>
                        <td className="px-4 py-2">{c.metrics.avgScore}</td>
                        <td className="px-4 py-2">{money(c.metrics.costPerHot)}</td>
                        <td className="px-4 py-2">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs ring-1", actionClass(c.action))}>
                            {c.action}
                            {c.needsReview ? " · HITL" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(c)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">No campaigns in this filter.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingest spend CSV</CardTitle>
              <CardDescription>POST /api/campaigns/ingest — Meta/Google not connected.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3" onSubmit={(e) => void ingest(e)}>
                <Textarea className="min-h-40 font-mono text-[11px]" value={csv} onChange={(e) => setCsv(e.target.value)} />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={running}>
                  {running ? "Scoring…" : "Join & score"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.platform} · {selected.status} · engine {selected.engine}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs ring-1", actionClass(selected.action))}>
                    {selected.action}
                  </span>
                  <Badge variant="outline">{Math.round(selected.confidence * 100)}% confidence</Badge>
                  {selected.demoMode ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                      Demo — heuristic, not Ads Manager
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed">{selected.reasoning}</p>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  <li>Spend {money(selected.spend)}</li>
                  <li>Forms {selected.metrics.formLeads}</li>
                  <li>Scored leads {selected.metrics.nLeads}</li>
                  <li>Spam {selected.metrics.nSpam}</li>
                  <li>Avg score {selected.metrics.avgScore}</li>
                  <li>Hot {selected.metrics.nHot}</li>
                  <li>CPL {money(selected.metrics.cpl)}</li>
                  <li>$/hot {money(selected.metrics.costPerHot)}</li>
                </ul>
                <div>
                  <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Leads on this campaign</p>
                  <ScrollArea className="h-40">
                    <ul className="space-y-1 text-xs">
                      {related.map((lead) => (
                        <li key={lead.id} className="flex justify-between gap-2">
                          <span>{lead.name}</span>
                          <span className="text-muted-foreground">
                            {lead.score} · {lead.tier} · {lead.classification}
                          </span>
                        </li>
                      ))}
                      {related.length === 0 ? <li className="text-muted-foreground">No attributed leads in the demo seed.</li> : null}
                    </ul>
                  </ScrollArea>
                </div>
                <Textarea placeholder="Reviewer note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <SheetFooter className="flex-row flex-wrap gap-2">
                <Button variant="destructive" onClick={() => void review(selected.id, "pause")}>
                  <Pause className="size-4" /> Confirm pause
                </Button>
                <Button variant="secondary" onClick={() => void review(selected.id, "scale")}>
                  Confirm scale
                </Button>
                <Button variant="outline" onClick={() => void review(selected.id, "keep")}>
                  Keep
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
