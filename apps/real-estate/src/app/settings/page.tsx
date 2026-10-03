import { getSecret, isClaudeConfigured } from "@helix/core";
import { Bot, CalendarDays, Check, Clock, Coins, Database, Download, Eye, FileSpreadsheet, Globe, Mail, MessageCircle, Plug, ShieldCheck, SlidersHorizontal, Table2, Users, Webhook, X, type LucideIcon } from "lucide-react";
import { CommissionRateField } from "@/components/commission-kpi";
import { ToneSelect } from "@/components/draft-tone";
import { ImportPanel } from "@/components/import-panel";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AI_FEATURE_LABEL, EST_USD_PER_MILLION_INPUT_TOKENS, EST_USD_PER_MILLION_OUTPUT_TOKENS, aiUsageTotals, fmtUsd, type AiFeature } from "@/lib/ai-usage";
import { hubspotReady } from "@/lib/hubspot";
import { channelReady } from "@/lib/messaging";
import { lastNightlyRun } from "@/lib/nightly";
import { deskStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Perm = "full" | "own" | "view" | "none";
const ROLES: { role: string; who: string; perms: Perm[] }[] = [
  { role: "Owner", who: "Runs the agency account and billing", perms: ["full", "full", "full", "full", "full"] },
  { role: "Admin", who: "Manages the team and every listing", perms: ["full", "full", "full", "full", "view"] },
  { role: "Agent", who: "Works their own buyers, sellers and listings", perms: ["own", "own", "own", "own", "none"] },
  { role: "Viewer", who: "Read-only, for assistants or partners", perms: ["view", "view", "view", "none", "none"] },
];
const PERM_COLUMNS = ["Listings", "Buyers", "Sellers", "Approve outreach", "Team & billing"];

function PermCell({ p }: { p: Perm }) {
  if (p === "full")
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-300">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
        Full
      </span>
    );
  if (p === "own")
    return (
      <span className="inline-flex items-center gap-1.5 text-sky-300">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-500/15 ring-1 ring-sky-500/30">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
        Own only
      </span>
    );
  if (p === "view")
    return (
      <span className="inline-flex items-center gap-1.5 text-foreground/80">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-slate-500/15 ring-1 ring-slate-500/30">
          <Eye className="size-3" aria-hidden />
        </span>
        View
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-rose-500/10 text-rose-400/80 ring-1 ring-rose-500/25">
        <X className="size-3" strokeWidth={3} aria-hidden />
      </span>
      No access
    </span>
  );
}

type Integration = { name: string; does: string; icon: LucideIcon; connected: boolean; status: string; tone: string; how: string };
const SOON = "No connector yet — the switch unlocks once one is built and you sign in to the tool.";

function Status({ connected, children }: { connected: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        connected ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40" : "bg-slate-500/15 text-slate-300 ring-slate-400/30"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  const status = await deskStatus();
  const claude = isClaudeConfigured();
  const email = channelReady("email");
  const sms = channelReady("sms");
  const whatsapp = channelReady("whatsapp");
  const hubspot = hubspotReady();
  const cron = Boolean(getSecret("CRON_SECRET"));
  const nightly = lastNightlyRun();
  const usage = aiUsageTotals();
  const integrations: Integration[] = [
    {
      name: "Helix AI (Claude)",
      does: "Answers questions and proposes actions from your desk",
      icon: Bot,
      connected: claude,
      status: claude ? "Connected" : "Demo assistant",
      tone: "bg-orange-500/10 text-orange-300 ring-orange-500/30",
      how: claude ? "Set by the server's API key." : "Turns on when the server has an Anthropic API key.",
    },
    {
      name: "Email (Resend)",
      does: "Send approved drafts by email, one confirmed send at a time",
      icon: Mail,
      connected: email,
      status: email ? "Connected" : "Not connected",
      tone: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
      how: email ? "Set by the server's RESEND_API_KEY and RESEND_FROM." : "Turns on when the server has RESEND_API_KEY and RESEND_FROM (a sender on a domain verified in Resend).",
    },
    {
      name: "SMS & WhatsApp (Twilio)",
      does: "Send approved drafts by SMS or WhatsApp, one confirmed send at a time",
      icon: MessageCircle,
      connected: sms || whatsapp,
      status: sms && whatsapp ? "Connected" : sms || whatsapp ? "Partly connected" : "Not connected",
      tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
      how: sms || whatsapp ? "Set by the server's TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM." : "Turns on when the server has TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (TWILIO_WHATSAPP_FROM for a separate WhatsApp sender).",
    },
    {
      name: "Google Sheets",
      does: "Import listings or buyers from a published or link-shared sheet",
      icon: Table2,
      connected: true,
      status: "Available",
      tone: "bg-green-500/10 text-green-300 ring-green-500/30",
      how: "No sign-in needed: paste the sheet link under Import & export. The sheet must be published to the web or shared as \"Anyone with the link\".",
    },
    {
      name: "CRM (HubSpot)",
      does: "Create or update a buyer as a HubSpot contact, after you confirm",
      icon: Users,
      connected: hubspot,
      status: hubspot ? "Connected" : "Not connected",
      tone: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
      how: hubspot ? "Set by the server's HUBSPOT_TOKEN." : "Turns on when the server has HUBSPOT_TOKEN (a HubSpot private app token with contacts write access).",
    },
    {
      name: "Nightly matching",
      does: "Matches new or changed listings to buyers every night and queues drafts. Never sends.",
      icon: Clock,
      connected: cron,
      status: cron ? (nightly ? `Last run ${new Date(nightly.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Scheduled") : "Not set up",
      tone: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
      how: cron
        ? `Vercel Cron calls it daily at 07:00 UTC.${nightly ? ` Last run: ${nightly.changed} changed listing${nightly.changed === 1 ? "" : "s"}, ${nightly.drafted} draft${nightly.drafted === 1 ? "" : "s"} queued, 0 sent.` : ""}`
        : "Turns on when the server has CRON_SECRET; the schedule is in vercel.json.",
    },
    { name: "Google / Outlook Calendar", does: "Two-way sync for showings and invites", icon: CalendarDays, connected: false, status: "Not connected", tone: "bg-blue-500/10 text-blue-300 ring-blue-500/30", how: SOON },
    { name: "GoHighLevel", does: "Keep buyers and sellers in sync with GoHighLevel", icon: Users, connected: false, status: "Not connected", tone: "bg-amber-500/10 text-amber-300 ring-amber-500/30", how: SOON },
    { name: "Portals (Zillow, Idealista)", does: "Import leads and publish listings", icon: Globe, connected: false, status: "Not connected", tone: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30", how: SOON },
    { name: "Webhooks / Zapier", does: "Push desk events to your other tools", icon: Webhook, connected: false, status: "Not connected", tone: "bg-violet-500/10 text-violet-300 ring-violet-500/30", how: SOON },
  ];

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your desk, your team and the tools Helix connects to.</p>
      </header>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="desk-heading">
        <h2 id="desk-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Database className="size-4 text-primary" aria-hidden /> Desk
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">Mode</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{status.demo ? "Demo sandbox" : status.imported ? "Live — your imported data" : "Live"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">Storage</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">In memory — resets when the server restarts</dd>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">Records</dt>
            <dd className="tabular mt-0.5 font-mono text-sm font-semibold text-foreground">{status.count} listings and buyers</dd>
          </div>
        </dl>
        {status.demo ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Everything here is sample data. Reloading puts the desk back to its starting point.</p>
            <ResetDemoButton />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="team-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="team-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden /> Team &amp; roles
            </h2>
            <p className="text-xs text-muted-foreground">Who can do what once sign-in is on. Today the desk has a single local user.</p>
          </div>
          <button type="button" disabled title="Needs sign-in" className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground opacity-60">
            <Users className="size-4" aria-hidden /> Invite a teammate
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">You</span>
          <span className="flex-1 text-sm text-foreground">
            You <span className="text-muted-foreground">· this browser, no account</span>
          </span>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/40">Owner</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Planned permissions by role</caption>
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                <th className="pb-2 pl-3 font-semibold">Role</th>
                {PERM_COLUMNS.map((c) => (
                  <th key={c} className="pb-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.role} className="odd:bg-muted/25">
                  <td className="rounded-l-lg py-2.5 pr-3 pl-3">
                    <span className="font-semibold text-foreground">{r.role}</span>
                    <span className="block text-xs text-muted-foreground">{r.who}</span>
                  </td>
                  {r.perms.map((p, i) => (
                    <td key={i} className="py-2.5 text-xs">
                      <PermCell p={p} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Planned: accounts, invites and these roles arrive with multi-user sign-in (Supabase). Until then, roles aren&apos;t enforced and there&apos;s nobody to invite.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="prefs-heading">
        <h2 id="prefs-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden /> Preferences
        </h2>
        <p className="text-xs text-muted-foreground">Kept in this browser only.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">Appearance</p>
            <ThemeToggle className="border border-border" />
            <p className="text-[11px] text-muted-foreground">Light mode for bright offices; dark for evenings.</p>
          </div>
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">Outreach</p>
            <ToneSelect />
            <p className="text-[11px] text-muted-foreground">Changes the greeting and closing of new drafts. The facts in each draft stay the same.</p>
          </div>
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">Dashboard</p>
            <CommissionRateField />
            <p className="text-[11px] text-muted-foreground">Used only for &ldquo;Commission in pipeline&rdquo;. Helix never guesses it.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="data-heading">
        <h2 id="data-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileSpreadsheet className="size-4 text-primary" aria-hidden /> Import &amp; export
        </h2>
        <p className="text-xs text-muted-foreground">
          Bring in your real listings and buyers from a CSV or a Google Sheet, or download what&apos;s on the desk as CSV for Excel, Google Sheets or another CRM.
        </p>
        <div id="import" className="mt-4 scroll-mt-6 rounded-lg border border-border bg-background/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Import</h3>
          <ImportPanel />
          <p className="mt-3 text-[11px] text-muted-foreground">
            {status.demo
              ? "Your first import removes the sample agency — demo and real data are never shown together. "
              : ""}
            Imported records live in this server&apos;s memory: a restart or a new deployment clears them, so keep your sheet as the source of truth and re-import when
            needed. Re-importing a row with the same listing ID (or address) or buyer email updates it instead of duplicating it.
          </p>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-foreground">Export</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["leads", "Buyers"],
              ["properties", "Listings"],
              ["sellers", "Sellers"],
              ["showings", "Showings"],
            ] as const
          ).map(([k, label]) => (
            <a key={k} href={`/api/export/${k}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-accent">
              <Download className="size-4" aria-hidden /> {label} CSV
            </a>
          ))}
          <a href="/api/calendar/ics" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-accent">
            <CalendarDays className="size-4" aria-hidden /> Upcoming showings (.ics)
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="ai-cost-heading">
        <h2 id="ai-cost-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Coins className="size-4 text-primary" aria-hidden /> AI usage <span className="text-sm font-normal text-muted-foreground">(estimated)</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Claude calls this server made since it started: listing copy, match alerts, market briefs and nightly matching. The cost is an estimate at $
          {EST_USD_PER_MILLION_INPUT_TOKENS} per million input tokens and ${EST_USD_PER_MILLION_OUTPUT_TOKENS} per million output tokens (list price) — your Anthropic invoice is
          the real figure. The Ask Helix chat isn&apos;t counted here.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-4">
          {[
            ["Calls", usage.calls.toLocaleString("en-US")],
            ["Input tokens", usage.inputTokens.toLocaleString("en-US")],
            ["Output tokens", usage.outputTokens.toLocaleString("en-US")],
            ["Estimated cost", `${fmtUsd(usage.estUsd)} estimated`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background/40 p-3">
              <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</dt>
              <dd className="tabular mt-0.5 font-mono text-sm font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {usage.calls ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {(Object.entries(usage.byFeature) as [AiFeature, { calls: number; estUsd: number }][]).map(([f, v]) => (
              <li key={f} className="rounded-full border border-border px-2.5 py-0.5">
                {AI_FEATURE_LABEL[f]}: {v.calls} call{v.calls === 1 ? "" : "s"} · {fmtUsd(v.estUsd)} estimated
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">{claude ? "No Claude calls yet." : "Claude isn't connected, so nothing has been spent; the desk uses templates."}</p>
        )}
      </section>

      <section id="integrations" className="scroll-mt-6 rounded-xl border border-border bg-card/80 p-5" aria-labelledby="int-heading">
        <h2 id="int-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Plug className="size-4 text-primary" aria-hidden /> Integrations
        </h2>
        <p className="text-xs text-muted-foreground">Real connection status, read from the server&apos;s environment. Until a channel is connected, Helix drafts and you send it yourself.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {integrations.map(({ name, does, icon: Icon, connected, status: label, tone, how }) => (
            <li key={name} className={cn("flex flex-col gap-3 rounded-xl border bg-background/40 p-4 transition", connected ? "border-emerald-500/30" : "border-border")}>
              <div className="flex items-start gap-3">
                <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl ring-1", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{name}</span>
                  <span className="block text-xs text-muted-foreground">{does}</span>
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                <Status connected={connected}>{label}</Status>
                <span className="flex items-center gap-2" title={how}>
                  <span className="text-[11px] text-muted-foreground">{connected ? "On" : "Off"}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={connected}
                    aria-label={`${name}: ${connected ? "on" : "off"}. ${how}`}
                    disabled
                    className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full ring-1 transition", connected ? "bg-emerald-500/80 ring-emerald-400/50" : "bg-muted ring-border opacity-70")}
                  >
                    <span className={cn("inline-block size-4 rounded-full bg-white shadow transition", connected ? "translate-x-[18px]" : "translate-x-0.5")} />
                  </button>
                </span>
              </div>
              <p className="-mt-1 text-[11px] text-muted-foreground">{how}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="diag-heading">
        <h2 id="diag-heading" className="text-lg font-semibold text-foreground">
          Diagnostics
        </h2>
        <p className="mt-1 text-sm text-foreground/90">
          In development, Next.js may show an &ldquo;Issue&rdquo; badge in the corner when the page is opened in Cursor&apos;s built-in browser. It&apos;s a hydration
          warning caused by the <code className="rounded bg-muted px-1 font-mono text-xs">data-cursor-ref</code> attributes that browser adds before the app loads — not
          an error in Helix. It doesn&apos;t appear in a regular browser or in production.
        </p>
      </section>
    </>
  );
}
