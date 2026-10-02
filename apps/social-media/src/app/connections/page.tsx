import { WebhooksPanel } from "@/components/webhooks-panel";
import { ChannelBadge } from "@/components/bits";
import { connectionReport } from "@/lib/connections";
import { channelLabel } from "@/lib/format";
import { listWebhooks } from "@/lib/store";

export const dynamic = "force-dynamic";

const NETWORK: Record<string, string> = {
  instagram: "Meta Content Publishing",
  facebook: "Meta Content Publishing",
  linkedin: "LinkedIn Marketing",
  x: "X API",
  tiktok: "TikTok Content Posting",
};

const TOKEN_COPY = {
  missing: "Disconnected",
  set: "Token present",
  expired: "Expired",
} as const;

const TOKEN_TONE = {
  missing: "bg-slate-400/15 text-slate-200",
  set: "bg-emerald-400/15 text-emerald-200",
  expired: "bg-amber-400/15 text-amber-100",
} as const;

export default async function ConnectionsPage() {
  const report = connectionReport();
  const { hooks, outbox } = await listWebhooks();
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Connections</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Optional path from this desk to official network APIs. Approval here is still a sign-off. This build does not send posts, even if a token is present.
        </p>
      </header>

      <section className="max-w-3xl rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Publishing adapter</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Set <span className="font-mono text-foreground">HELIX_SOCIAL_PUBLISH=live</span> only after a reviewed adapter is deployed. Right now the switch is {report.publishSwitch ? "on" : "off"}, and there is still no adapter in this build, so nothing can leave the desk.
        </p>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {report.channels.map((channel) => (
          <li key={channel.channel} className="rounded-xl border border-border bg-card/80 p-4">
            <ChannelBadge channel={channel.channel} />
            <p className="mt-3 text-sm font-semibold text-foreground">{channelLabel(channel.channel)}</p>
            <p className="text-xs text-muted-foreground">{NETWORK[channel.channel]}</p>
            <p className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TOKEN_TONE[channel.tokenState]}`}>{TOKEN_COPY[channel.tokenState]}</p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">{channel.tokenEnv}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{channel.expiresEnv}</p>
            <button type="button" disabled className="mt-3 inline-flex min-h-9 cursor-not-allowed items-center rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground">
              Reconnect
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">OAuth redirect is not wired. This does not start a login.</p>
          </li>
        ))}
      </ul>

      <section className="max-w-3xl rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">OAuth</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Reconnect is not wired. This page only reads whether an environment variable is set and whether its expiry timestamp is in the past. It never shows the token, and it never starts an OAuth redirect.
        </p>
      </section>

      <WebhooksPanel hooks={hooks} outbox={outbox} />
    </>
  );
}
