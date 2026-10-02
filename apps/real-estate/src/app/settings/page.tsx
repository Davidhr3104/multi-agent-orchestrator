import { isClaudeConfigured } from "@helix/core";
import { Bot, CalendarDays, Check, Database, Download, Eye, FileSpreadsheet, Globe, Mail, MessageCircle, Plug, ShieldCheck, SlidersHorizontal, Users, Webhook, X, type LucideIcon } from "lucide-react";
import { CommissionRateField } from "@/components/commission-kpi";
import { ToneSelect } from "@/components/draft-tone";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { ThemeToggle } from "@/components/theme-toggle";
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
    { name: "WhatsApp Business", does: "Send approved drafts and log replies", icon: MessageCircle, connected: false, status: "Not connected", tone: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", how: SOON },
    { name: "Email (Gmail / Outlook)", does: "Send approved drafts from your own address", icon: Mail, connected: false, status: "Not connected", tone: "bg-sky-500/10 text-sky-300 ring-sky-500/30", how: SOON },
    { name: "Google / Outlook Calendar", does: "Two-way sync for showings and invites", icon: CalendarDays, connected: false, status: "Not connected", tone: "bg-blue-500/10 text-blue-300 ring-blue-500/30", how: SOON },
    { name: "CRM (HubSpot, GoHighLevel)", does: "Keep buyers and sellers in sync with your CRM", icon: Users, connected: false, status: "Not connected", tone: "bg-amber-500/10 text-amber-300 ring-amber-500/30", how: SOON },
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
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{status.demo ? "Demo sandbox" : "Live"}</dd>
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
        <p className="text-xs text-muted-foreground">Download what&apos;s on the desk right now as CSV for Excel, Google Sheets or another CRM.</p>
        <div className="mt-4 flex flex-wrap gap-2">
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
        <p className="mt-3 text-[11px] text-muted-foreground">CSV import isn&apos;t available yet — it arrives with saved storage, so imported records don&apos;t vanish on restart.</p>
      </section>

      <section id="integrations" className="scroll-mt-6 rounded-xl border border-border bg-card/80 p-5" aria-labelledby="int-heading">
        <h2 id="int-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Plug className="size-4 text-primary" aria-hidden /> Integrations
        </h2>
        <p className="text-xs text-muted-foreground">Real connection status. Until a tool is connected, Helix drafts and you send it yourself.</p>
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
