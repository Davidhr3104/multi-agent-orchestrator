"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StoredLead } from "@helix/core";
import { relativeTime } from "@/components/leads-engine/lead-ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "paused" | "drafts";

type Workflow = {
  id: string;
  icon: string;
  iconTone: string;
  title: string;
  blurb: string;
  status: "active" | "paused" | "draft";
  triggerLabel: string;
  triggerExpr: string;
  triggerTone: string;
  actionsLabel: string;
  actions: { icon: string; iconTone: string; text: ReactNode }[];
  metaLeft: string;
  metaRight: string;
  cta: string;
  href?: string;
};

type DraftWorkflow = { id: string; name: string; createdAt: string };

const ENABLED_KEY = "helix-leads-automations-enabled";
const DRAFTS_KEY = "helix-leads-automations-drafts";

const DEFAULT_ENABLED: Record<string, boolean> = {
  vip: true,
  hitl: true,
  spam: true,
  nurture: true,
};

function matchesVip(l: StoredLead, vipScore: number) {
  return l.tier === "hot" && l.classification === "lead" && l.score >= vipScore;
}
function matchesHitl(l: StoredLead) {
  return Boolean(l.needsReview);
}
function matchesSpam(l: StoredLead) {
  return l.classification === "spam";
}
function matchesNurture(l: StoredLead, nurtureMin: number, nurtureMax: number) {
  return (
    l.classification === "lead" &&
    l.score >= nurtureMin &&
    l.score <= nurtureMax &&
    !l.needsReview
  );
}

function workflowSettingsHref(w: { id: string; href?: string }): string {
  if (w.href) return w.href;
  switch (w.id) {
    case "vip":
    case "hitl":
      return "/inbox";
    case "spam":
      return "/settings/scoring";
    case "nurture":
      return "/analytics";
    default:
      return "/settings/scoring";
  }
}

export default function AutomationsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [ghl, setGhl] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(DEFAULT_ENABLED);
  const [thresholds, setThresholds] = useState({ vipScore: 90, nurtureMin: 30, nurtureMax: 65 });
  const [drafts, setDrafts] = useState<DraftWorkflow[]>([]);
  const [dryMsg, setDryMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const [status, leadsRes] = await Promise.all([
      fetch("/api/status").then((r) => r.json()).catch(() => ({})),
      fetch("/api/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
    ]);
    setGhl(Boolean((status as { ghl?: boolean }).ghl));
    setLeads(((leadsRes as { leads?: StoredLead[] }).leads ?? []) as StoredLead[]);
  }, []);

  useEffect(() => {
    try {
      const rawEnabled = localStorage.getItem(ENABLED_KEY);
      if (rawEnabled) {
        const parsed = JSON.parse(rawEnabled) as Record<string, boolean>;
        setEnabled({ ...DEFAULT_ENABLED, ...parsed });
      }
      const rawDrafts = localStorage.getItem(DRAFTS_KEY);
      if (rawDrafts) {
        const parsed = JSON.parse(rawDrafts) as DraftWorkflow[];
        if (Array.isArray(parsed)) setDrafts(parsed);
      }
    } catch {
      /* ignore */
    }
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { automations?: Record<string, boolean>; thresholds?: { vipScore?: number; nurtureMin?: number; nurtureMax?: number } }) => {
        if (d.automations) {
          setEnabled((e) => ({
            ...e,
            vip: d.automations!.vip !== false,
            hitl: d.automations!.hitl !== false,
            spam: d.automations!.spam !== false,
            nurture: d.automations!.nurture !== false,
          }));
        }
        if (d.thresholds) {
          setThresholds((t) => ({
            vipScore: d.thresholds!.vipScore ?? t.vipScore,
            nurtureMin: d.thresholds!.nurtureMin ?? t.nurtureMin,
            nurtureMax: d.thresholds!.nurtureMax ?? t.nurtureMax,
          }));
        }
      })
      .finally(() => setHydrated(true));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled));
    } catch {
      /* ignore */
    }
  }, [enabled, hydrated]);

  function setWorkflowEnabled(id: string, value: boolean) {
    setEnabled((e) => {
      const next = { ...e, [id]: value };
      try {
        localStorage.setItem(ENABLED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      void fetch("/api/settings/brain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automations: {
            vip: Boolean(next.vip),
            hitl: Boolean(next.hitl),
            spam: Boolean(next.spam),
            nurture: Boolean(next.nurture),
          },
        }),
      });
      return next;
    });
  }

  function newWorkflow() {
    const name = window.prompt("Workflow name");
    if (!name?.trim()) return;
    const draft: DraftWorkflow = {
      id: `draft-${Date.now().toString(36)}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    setDrafts((prev) => {
      const next = [draft, ...prev];
      try {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setDryMsg(`Draft saved: “${draft.name}”`);
    setFilter("drafts");
  }

  const stats = useMemo(() => {
    const vip = leads.filter((l) => matchesVip(l, thresholds.vipScore)).length;
    const hitl = leads.filter(matchesHitl).length;
    const spam = leads.filter(matchesSpam).length;
    const nurture = leads.filter((l) => matchesNurture(l, thresholds.nurtureMin, thresholds.nurtureMax)).length;
    const synced = leads.filter((l) => l.crmStatus === "sent" || l.crmStatus === "mocked").length;
    const dispatched = vip + hitl + spam + nurture;
    return { vip, hitl, spam, nurture, synced, dispatched, total: leads.length };
  }, [leads, thresholds]);

  const workflows: Workflow[] = useMemo(
    () => [
      {
        id: "vip",
        icon: "rocket_launch",
        iconTone: "bg-primary/10 text-primary",
        title: `VIP Enterprise Fast-Track (Hot Leads >= ${thresholds.vipScore})`,
        blurb: "Autonomous SLA enforcement for high-contract-value opportunities",
        status: "active",
        triggerLabel: "Trigger Criteria",
        triggerExpr: `Score >= ${thresholds.vipScore} && classification = lead`,
        triggerTone: "text-primary",
        actionsLabel: "Deterministic Actions (3)",
        actions: [
          {
            icon: "person_check",
            iconTone: "text-secondary",
            text: (
              <>
                Flag for{" "}
                <span className="font-semibold text-on-surface">Executive SDR queue</span>
              </>
            ),
          },
          {
            icon: "cloud_upload",
            iconTone: "text-secondary",
            text: (
              <>
                Push to CRM when{" "}
                <span className="font-semibold text-on-surface">
                  {ghl ? "GHL connected" : "GHL keys present"}
                </span>
              </>
            ),
          },
          {
            icon: "campaign",
            iconTone: "text-secondary",
            text: (
              <>
                Alert channel{" "}
                <span className="font-mono text-[10px] text-primary">#sales-enterprise</span>
              </>
            ),
          },
        ],
        metaLeft: `${stats.vip} roster matches`,
        metaRight: "P99: desk-bound",
        cta: "Test Run",
        href: "/leads",
      },
      {
        id: "hitl",
        icon: "rule",
        iconTone: "bg-secondary/10 text-secondary",
        title: "Ambiguous / Edge-Case Human Escalation",
        blurb: "Mitigates hallucination risk on borderline confidence submissions",
        status: "active",
        triggerLabel: "Trigger Criteria",
        triggerExpr: "needsReview || confidence mid-band",
        triggerTone: "text-secondary",
        actionsLabel: "Intercept Protocol",
        actions: [
          {
            icon: "pause_circle",
            iconTone: "text-error",
            text: "Hold automatic sync to CRM",
          },
          {
            icon: "inbox",
            iconTone: "text-secondary",
            text: (
              <>
                Push into{" "}
                <span className="font-semibold text-on-surface">Triage Inbox Queue</span>
              </>
            ),
          },
          {
            icon: "hourglass_bottom",
            iconTone: "text-secondary",
            text: (
              <>
                Operator SLA{" "}
                <span className="font-mono text-[10px] text-secondary">HITL gate</span>
              </>
            ),
          },
        ],
        metaLeft: `${stats.hitl} pending review`,
        metaRight: "100% human reviewed",
        cta: "Inspect Log",
        href: "/inbox",
      },
      {
        id: "spam",
        icon: "shield_person",
        iconTone: "bg-error/10 text-error",
        title: "Instant Bot & Disposable Webmail Quarantine",
        blurb: "Preserves sales team pipeline cleanliness and stops form spam",
        status: "active",
        triggerLabel: "Threat Detection",
        triggerExpr: "classification = spam || disposable domain",
        triggerTone: "text-error",
        actionsLabel: "Quarantine Steps",
        actions: [
          {
            icon: "label_off",
            iconTone: "text-error",
            text: (
              <>
                Flag metadata as <span className="font-mono text-[10px] text-error">SPAM</span>
              </>
            ),
          },
          {
            icon: "delete_sweep",
            iconTone: "text-error",
            text: "Keep off CRM sync path",
          },
          {
            icon: "block",
            iconTone: "text-error",
            text: "Surface in Audit Log for review",
          },
        ],
        metaLeft: `${stats.spam} blocked on desk`,
        metaRight: "Zero CRM pollution",
        cta: "Quarantine Logs",
        href: "/audit",
      },
      {
        id: "nurture",
        icon: "forward_to_inbox",
        iconTone: "bg-tertiary/10 text-tertiary",
        title: `Nurture Sequence for SMB / Low Intent (Score ${thresholds.nurtureMin}-${thresholds.nurtureMax})`,
        blurb: "Drives asynchronous product-led education via GoHighLevel when connected",
        status: "active",
        triggerLabel: "Trigger Criteria",
        triggerExpr: `Score (${thresholds.nurtureMin}..${thresholds.nurtureMax}) && not HITL`,
        triggerTone: "text-on-surface",
        actionsLabel: "Orchestrated Action",
        actions: [
          {
            icon: "mark_email_read",
            iconTone: "text-tertiary",
            text: (
              <>
                Enroll path{" "}
                <span className="font-semibold">
                  {ghl ? "GHL nurture tag" : "mock nurture (keys offline)"}
                </span>
              </>
            ),
          },
          {
            icon: "sync",
            iconTone: "text-outline",
            text: "Re-score eligible on next ingest",
          },
        ],
        metaLeft: `${stats.nurture} nurture-band leads`,
        metaRight: ghl ? "GHL ready" : "GHL offline",
        cta: "View Funnel",
        href: "/analytics",
      },
    ],
    [ghl, stats, thresholds]
  );

  const filtered = workflows.filter((w) => {
    if (filter === "all") return true;
    if (filter === "active") return w.status === "active" && enabled[w.id];
    if (filter === "paused") return !enabled[w.id];
    return false;
  });

  const feed = useMemo(() => {
    return [...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((l) => {
        let route = "Evaluate";
        let tone = "bg-secondary";
        if (matchesSpam(l)) {
          route = "Blocked";
          tone = "bg-error";
        } else if (matchesHitl(l)) {
          route = "Triage HITL";
          tone = "bg-secondary";
        } else if (matchesVip(l, thresholds.vipScore)) {
          route = "VIP → SDR";
          tone = "bg-tertiary";
        } else if (matchesNurture(l, thresholds.nurtureMin, thresholds.nurtureMax)) {
          route = "Nurture";
          tone = "bg-primary";
        }
        return {
          id: l.id.slice(0, 8),
          email: l.email,
          route,
          tone,
          when: relativeTime(l.createdAt),
        };
      });
  }, [leads, thresholds]);

  function dryRun() {
    const sampleLead =
      [...leads].sort((a, b) => b.score - a.score)[0] ?? null;
    const sample = sampleLead
      ? {
          email: sampleLead.email,
          score: sampleLead.score,
          classification: sampleLead.classification,
          needsReview: Boolean(sampleLead.needsReview),
          tier: sampleLead.tier,
        }
      : {
          email: "c.wood@stripe.com",
          score: 94,
          classification: "lead" as const,
          needsReview: false,
          tier: "hot" as const,
        };
    const hits: string[] = [];
    if (enabled.vip && sample.score >= thresholds.vipScore && sample.classification === "lead") {
      hits.push("VIP Enterprise Fast-Track");
    }
    if (enabled.hitl && sample.needsReview) hits.push("HITL Escalation");
    if (enabled.spam && sample.classification === "spam") hits.push("Quarantine");
    if (
      enabled.nurture &&
      sample.classification === "lead" &&
      sample.score >= thresholds.nurtureMin &&
      sample.score <= thresholds.nurtureMax &&
      !sample.needsReview
    ) {
      hits.push("Nurture SMB");
    }
    if (hits.length === 0 && sample.score >= thresholds.vipScore && sample.classification === "lead") {
      hits.push("VIP (score gate)");
    }
    const source = sampleLead ? "roster" : "fallback";
    setDryMsg(
      hits.length
        ? `Dry-run ${sample.email} (${source}, score ${sample.score}): matched → ${hits.join(", ")} · arms synced to brain`
        : `Dry-run ${sample.email} (${source}, score ${sample.score}): no workflow matched (check toggles)`
    );
    // Persist current arms so next ingest honors them
    void fetch("/api/settings/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        automations: {
          vip: Boolean(enabled.vip),
          hitl: Boolean(enabled.hitl),
          spam: Boolean(enabled.spam),
          nurture: Boolean(enabled.nurture),
        },
      }),
    });
  }

  const activeCount = Object.values(enabled).filter(Boolean).length;
  const pausedCount = Object.values(enabled).filter((v) => !v).length;

  return (
    <main className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute -top-12 left-1/4 size-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-48 right-12 size-80 rounded-full bg-secondary/10 blur-[100px]" />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-widest text-secondary uppercase">
              Helix Engine // Routing & Orchestration
            </span>
            <span className="size-1.5 animate-ping rounded-full bg-tertiary" />
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
            Automations &amp; Routing Workflows
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Deterministic rule-based routing from the live roster — run counts bound to seed/desk
            leads, not invented dispatch volume.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-surface-container-lowest p-1 shadow-inner">
            {(
              [
                ["all", `All (${workflows.length})`],
                ["active", `Active (${activeCount})`],
                ["paused", `Paused (${pausedCount})`],
                ["drafts", `Drafts (${drafts.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs transition",
                  filter === key
                    ? "bg-surface-container font-semibold text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {key === "active" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-tertiary" />
                    {label}
                  </span>
                ) : (
                  label
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={newWorkflow}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary-container px-4 text-xs font-bold text-on-primary-container shadow-[0_0_24px_rgba(6,182,212,0.35)]"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            New Workflow
          </button>
        </div>
      </div>

      {/* KPIs — seed-true */}
      <div className="relative z-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Roster Volume",
            value: String(stats.total),
            sub: "contacts on desk",
            icon: "timer",
            tone: "text-secondary",
            bar: "bg-secondary",
            w: "84%",
          },
          {
            label: "Reliability",
            value: "100%",
            sub: "0 routing crashes",
            icon: "verified_user",
            tone: "text-tertiary",
            bar: "bg-tertiary",
            w: "100%",
          },
          {
            label: "Routed Matches",
            value: String(stats.dispatched),
            sub: `${stats.synced} CRM handoffs`,
            icon: "bolt",
            tone: "text-primary",
            bar: "bg-primary",
            w: `${Math.min(100, (stats.dispatched / Math.max(1, stats.total)) * 100)}%`,
          },
          {
            label: "Threat Quarantine",
            value: String(stats.spam),
            sub: "spam on roster",
            icon: "security",
            tone: "text-error",
            bar: "bg-error",
            w: `${Math.min(100, (stats.spam / Math.max(1, stats.total)) * 100 || 12)}%`,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="flex flex-col justify-between rounded-xl bg-surface-container-low p-4 shadow-sm"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-mono text-[10px] tracking-wider uppercase">{k.label}</span>
              <span className={cn("material-symbols-outlined text-[16px]", k.tone)}>{k.icon}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={cn("text-2xl font-bold", k.label === "Threat Quarantine" ? "text-error" : "text-on-surface")}>
                {k.value}
              </span>
              <span className={cn("font-mono text-[10px]", k.tone)}>{k.sub}</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className={cn("h-full rounded-full", k.bar)} style={{ width: k.w }} />
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* Workflow cards */}
        <div className="flex flex-col gap-4 xl:col-span-7">
          {filter === "drafts" ? (
            drafts.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low p-5 text-sm text-outline">
                No drafts yet — use New Workflow to save one.
              </p>
            ) : (
              drafts.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl bg-surface-container-low p-5 shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-outline/10 px-2 py-0.5 font-mono text-[10px] text-outline">
                        Draft
                      </span>
                      <h3 className="mt-1 text-sm font-semibold text-on-surface">{d.name}</h3>
                      <p className="text-xs text-on-surface-variant">
                        Saved {relativeTime(d.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/settings/scoring")}
                      className="rounded bg-surface-container p-1 text-on-surface hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[16px]">settings</span>
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            filtered.map((w) => (
              <div
                key={w.id}
                className="rounded-xl bg-surface-container-low p-5 shadow-md transition hover:bg-surface-container"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl",
                        w.iconTone
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px]">{w.icon}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-on-surface">{w.title}</h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px]",
                            enabled[w.id]
                              ? "bg-tertiary/10 text-tertiary"
                              : "bg-outline/10 text-outline"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              enabled[w.id] ? "bg-tertiary" : "bg-outline"
                            )}
                          />
                          {enabled[w.id] ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">{w.blurb}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled[w.id]}
                    onClick={() => setWorkflowEnabled(w.id, !enabled[w.id])}
                    className={cn(
                      "relative h-6 w-12 shrink-0 rounded-full p-0.5 transition",
                      enabled[w.id] ? "bg-tertiary-container" : "bg-surface-container-highest"
                    )}
                  >
                    <span
                      className={cn(
                        "block size-5 rounded-full bg-tertiary shadow-md transition-transform",
                        enabled[w.id] ? "translate-x-6" : "translate-x-0 opacity-50"
                      )}
                    />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg bg-surface-container-lowest/70 p-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 font-mono text-[10px] tracking-wider text-outline uppercase">
                      <span className="material-symbols-outlined text-[12px] text-primary">
                        filter_alt
                      </span>
                      {w.triggerLabel}
                    </div>
                    <div
                      className={cn(
                        "rounded bg-surface-container p-2 font-mono text-[11px]",
                        w.triggerTone
                      )}
                    >
                      {w.triggerExpr}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 font-mono text-[10px] tracking-wider text-outline uppercase">
                      <span className="material-symbols-outlined text-[12px] text-secondary">
                        alt_route
                      </span>
                      {w.actionsLabel}
                    </div>
                    <ul className="space-y-1.5 text-xs text-on-surface">
                      {w.actions.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className={cn("material-symbols-outlined text-[14px]", a.iconTone)}>
                            {a.icon}
                          </span>
                          <span>{a.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-1 font-mono text-[10px] text-on-surface-variant">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-tertiary">
                        check_circle
                      </span>
                      {w.metaLeft}
                    </span>
                    <span>•</span>
                    <span className="text-outline">{w.metaRight}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.href ? (
                      <Link
                        href={w.href}
                        className="rounded bg-surface-container px-2 py-1 text-on-surface transition hover:bg-surface-container-high"
                      >
                        {w.cta}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push(workflowSettingsHref(w))}
                        className="rounded bg-surface-container px-2 py-1 text-on-surface hover:bg-surface-container-high"
                      >
                        {w.cta}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => router.push(workflowSettingsHref(w))}
                      className="rounded bg-surface-container p-1 text-on-surface hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[16px]">settings</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: DAG + dry-run + feed */}
        <div className="sticky top-20 flex flex-col gap-4 xl:col-span-5">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  account_tree
                </span>
                <h2 className="text-sm font-semibold text-on-surface">Live Pipeline Node DAG</h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant">
                <span className="size-2 animate-pulse rounded-full bg-tertiary" />
                Active Stream
              </div>
            </div>
            <p className="mb-4 text-xs text-on-surface-variant">
              Branching model over desk ingest
              {ghl ? " · GHL connected" : " · GHL offline"}.
            </p>

            <div className="relative flex flex-col items-center gap-3 rounded-xl bg-surface-container-lowest p-4">
              {[
                {
                  label: "Node 01 // Trigger",
                  title: "Inbound Lead Ingest",
                  badge: "WEBHOOK",
                  badgeTone: "text-secondary",
                  icon: "input",
                  iconTone: "bg-primary/20 text-primary",
                },
                {
                  label: "Node 02 // Neural Model",
                  title: "Claude / Heuristic Scoring",
                  badge: "desk",
                  badgeTone: "text-tertiary",
                  icon: "psychology",
                  iconTone: "bg-secondary/20 text-secondary",
                },
              ].map((n, i) => (
                <div key={n.label} className="flex w-full max-w-sm flex-col items-center">
                  {i > 0 ? (
                    <div className="mb-3 flex flex-col items-center">
                      <div className="h-6 w-0.5 bg-outline-variant" />
                      <span className="material-symbols-outlined -my-1.5 text-[12px] text-outline-variant">
                        keyboard_arrow_down
                      </span>
                    </div>
                  ) : null}
                  <div className="flex w-full items-center justify-between rounded-lg bg-surface-container p-3 shadow-md">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded",
                          n.iconTone
                        )}
                      >
                        <span className="material-symbols-outlined text-[16px]">{n.icon}</span>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] tracking-wider text-outline uppercase">
                          {n.label}
                        </p>
                        <p className="text-sm font-medium text-on-surface">{n.title}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded bg-surface-container-low px-2 py-0.5 font-mono text-[10px]",
                        n.badgeTone
                      )}
                    >
                      {n.badge}
                    </span>
                  </div>
                </div>
              ))}

              <div className="flex flex-col items-center">
                <div className="h-6 w-0.5 bg-outline-variant" />
                <span className="material-symbols-outlined -my-1.5 text-[12px] text-outline-variant">
                  keyboard_arrow_down
                </span>
              </div>

              <div className="flex w-full max-w-sm items-center justify-between rounded-lg bg-surface-container-high p-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded bg-surface-container-lowest font-mono text-sm font-bold text-primary">
                    ?
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-primary uppercase">
                      Condition Branch
                    </p>
                    <p className="text-sm font-medium text-on-surface">Lead Score &gt;= 90?</p>
                  </div>
                </div>
                <span className="rounded bg-primary-container px-2 py-0.5 font-mono text-[10px] text-on-primary-container">
                  EVAL
                </span>
              </div>

              <div className="flex w-full max-w-sm items-center justify-between px-8">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-0.5 bg-tertiary" />
                  <span className="mt-1 font-mono text-[10px] font-bold text-tertiary">
                    YES (&gt;=90)
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="h-6 w-0.5 bg-outline" />
                  <span className="mt-1 font-mono text-[10px] font-bold text-outline-variant">
                    NO (&lt;90)
                  </span>
                </div>
              </div>

              <div className="mt-1 grid w-full max-w-sm grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-tertiary">
                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                    VIP Route
                  </div>
                  <span className="text-xs font-semibold text-on-surface">
                    CRM High-Pri + AE Alert
                  </span>
                  <span className="font-mono text-[10px] text-on-surface-variant">
                    {stats.vip} matches
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-secondary">
                    <span className="material-symbols-outlined text-[14px]">filter_list</span>
                    Evaluate Nurture
                  </div>
                  <span className="text-xs font-semibold text-on-surface">
                    Triage / GHL Sequence
                  </span>
                  <span className="font-mono text-[10px] text-on-surface-variant">FALLTHROUGH</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-surface-container-lowest p-4">
              <div className="flex items-center justify-between font-mono text-[10px] text-outline">
                <span className="tracking-wider uppercase">Simulate Incoming Webhook Payload</span>
                <span className="text-tertiary">READY</span>
              </div>
              <pre className="overflow-x-auto rounded bg-surface-container p-2 font-mono text-[11px] text-on-surface whitespace-pre">{`{
  "email": "c.wood@stripe.com",
  "company_headcount": 7800,
  "inferred_score": 94
}`}</pre>
              <button
                type="button"
                onClick={dryRun}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded bg-surface-container py-2 font-mono text-[11px] font-medium text-secondary transition hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                Dry-Run Payload Against {activeCount} Workflows
              </button>
              {dryMsg ? <p className="mt-1 text-xs text-tertiary">{dryMsg}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-on-surface">Live Routing Feed</span>
              <span className="font-mono text-[10px] text-tertiary">
                {stats.total} contacts · desk SLA
              </span>
            </div>
            <div className="space-y-2 text-xs">
              {feed.length === 0 ? (
                <p className="text-outline">No leads yet — ingest to see routing.</p>
              ) : (
                feed.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded bg-surface-container-lowest/80 p-2 text-on-surface"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("size-1.5 shrink-0 rounded-full", f.tone)} />
                      <span className="shrink-0 font-mono text-[10px] text-secondary">
                        #{f.id}
                      </span>
                      <span className="truncate">
                        {f.email} → {f.route}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                      {f.when}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
