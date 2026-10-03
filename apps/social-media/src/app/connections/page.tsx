import { WebhooksPanel } from "@/components/webhooks-panel";
import { ChannelBadge } from "@/components/bits";
import { connectionReport, type ChannelConnection } from "@/lib/connections";
import { channelLabel } from "@/lib/format";
import { currentInsights, metaConnected, type InsightsSnapshot } from "@/lib/social/insights";
import { listWebhooks } from "@/lib/store";

export const dynamic = "force-dynamic";

const NETWORK: Record<string, string> = {
  instagram: "Instagram Graph API · read insights and publish",
  facebook: "Facebook Pages API · read insights and publish",
  linkedin: "LinkedIn Posts API · publish as the organization",
  x: "X API · token only, no adapter",
  tiktok: "TikTok Content Posting · token only, no adapter",
};

type Tone = "muted" | "ok" | "warn";

const TONE: Record<Tone, string> = {
  muted: "bg-slate-400/15 text-slate-200",
  ok: "bg-emerald-400/15 text-emerald-200",
  warn: "bg-amber-400/15 text-amber-100",
};

function channelState(row: ChannelConnection, snap: InsightsSnapshot | null): { label: string; tone: Tone; detail: string } {
  if (row.tokenState === "missing") return { label: "Disconnected", tone: "muted", detail: "No token is set." };
  if (row.tokenState === "expired") return { label: "Expired", tone: "warn", detail: `${row.expiresEnv} is in the past.` };
  if (row.adapter === "token_only") return { label: "Token only", tone: "muted", detail: "This build has no adapter for this network. Nothing is read or sent." };
  if (row.adapter === "publish") {
    const missing = row.extraEnv.filter((env) => !env.present && !env.optional);
    return missing.length
      ? { label: "Token present", tone: "warn", detail: `Set ${missing.map((env) => env.name).join(", ")} to publish.` }
      : { label: "Token present · not verified", tone: "muted", detail: "Publishing scopes can't be checked with a read. The first accepted post proves the token works." };
  }
  if (!snap) return { label: "Token present · not checked", tone: "muted", detail: "Meta has not been called yet." };
  if (!snap.verification.ok) return { label: "Rejected by Meta", tone: "warn", detail: snap.verification.error ?? "Token check failed." };
  const read = row.channel === "instagram" ? snap.instagram : snap.facebook;
  const connected = metaConnected(snap)[row.channel as "instagram" | "facebook"];
  if (!connected) return { label: "Token valid · read failed", tone: "warn", detail: read.ok ? "" : read.error };
  const expiry = snap.verification.expiresAt ? `Token expires ${new Date(snap.verification.expiresAt).toLocaleDateString("en-US", { dateStyle: "medium" })}.` : "Meta reported no expiry date.";
  const account = read.ok ? read.account.name : "";
  return { label: "Connected", tone: "ok", detail: `${account} read at ${new Date(snap.fetchedAt).toLocaleTimeString("en-US", { timeStyle: "short" })}. ${expiry}` };
}

export default async function ConnectionsPage() {
  const report = connectionReport();
  const metaToken = report.channels.some((row) => row.channel === "instagram" && row.tokenState === "set");
  const [{ hooks, outbox }, snap] = await Promise.all([listWebhooks(), metaToken ? currentInsights() : Promise.resolve(null)]);
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Connections</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Official network APIs, configured with environment variables. &quot;Connected&quot; appears only after the network answered a real call. Tokens are never shown.
        </p>
      </header>

      <section className="max-w-3xl rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Publishing</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The live switch <span className="font-mono text-foreground">HELIX_SOCIAL_PUBLISH=live</span> is {report.publishSwitch ? "on" : "off"}.
          {report.publishSwitch
            ? " Instagram, Facebook and LinkedIn posts can go out, one at a time, when a person approves a post and presses Publish on it."
            : " Nothing can leave the desk until an operator sets it. Even then, each post needs a person's approval and a Publish press."}{" "}
          Helix AI and the cron never publish. X and TikTok have no adapter.
        </p>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {report.channels.map((channel) => {
          const state = channelState(channel, snap);
          return (
            <li key={channel.channel} className="rounded-xl border border-border bg-card/80 p-4">
              <ChannelBadge channel={channel.channel} />
              <p className="mt-3 text-sm font-semibold text-foreground">{channelLabel(channel.channel)}</p>
              <p className="text-xs text-muted-foreground">{NETWORK[channel.channel]}</p>
              <p className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[state.tone]}`}>{state.label}</p>
              {state.detail ? <p className="mt-1 text-[11px] text-muted-foreground">{state.detail}</p> : null}
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">{channel.tokenEnv}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{channel.expiresEnv}</p>
              {channel.extraEnv.map((env) => (
                <p key={env.name} className="font-mono text-[11px] text-muted-foreground">
                  {env.name}
                  {env.optional ? " (optional)" : ""} · {env.present ? "set" : "missing"}
                </p>
              ))}
            </li>
          );
        })}
      </ul>

      <section className="max-w-3xl rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">OAuth</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          There is no in-app OAuth login. An operator creates the tokens in the Meta and LinkedIn developer apps and sets them as environment variables on the deployment.
        </p>
      </section>

      <WebhooksPanel hooks={hooks} outbox={outbox} />
    </>
  );
}
