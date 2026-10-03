"use client";

import { useEffect, useState } from "react";
import { KNOWLEDGE_LINKS_KEY, readKnowledgeForm, type KnowledgeLinks } from "@/lib/knowledge-links";

type AiUsage = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  byPurpose: Record<string, { calls: number; estimatedUsd: number }>;
  since: string;
};

type Health = {
  gmailConnected: boolean;
  oauthConfigured: boolean;
  slack: boolean;
  teams: boolean;
  claude: boolean;
  microsoft?: { configured: boolean; connectedEmail: string | null };
  twilio?: { configured: boolean; from: string | null };
  cron?: { secretConfigured: boolean };
  aiUsage?: AiUsage;
};

type GoogleCalendarStatus = { connected: boolean; error: string | null; needsReconnect: boolean; count: number };

const TOKEN_KEY = "helix-inbox-integration-tokens";

type Tokens = Record<string, string>;

const CARDS = [
  { id: "gmail", name: "Gmail", detail: "OAuth mailbox sync" },
  { id: "gcal", name: "Google Calendar", detail: "Read-only events and free slots, through the same Google sign-in as Gmail" },
  { id: "m365", name: "Microsoft 365", detail: "One-click OAuth. Needs Microsoft app credentials on the server." },
  { id: "slack", name: "Slack", detail: "SLA and weekly report webhook" },
  { id: "twilio", name: "Twilio · SMS / WhatsApp", detail: "Sends a message only after you confirm it. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM on the server." },
  { id: "calendly", name: "Calendly", detail: "Upcoming meetings and the link for each one" },
  { id: "hubspot", name: "HubSpot", detail: "CRM note token" },
  { id: "salesforce", name: "Salesforce", detail: "CRM note token" },
];

function usd(n: number): string {
  return n < 0.01 && n > 0 ? "< $0.01" : `$${n.toFixed(2)}`;
}

export default function IntegrationsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [gcal, setGcal] = useState<GoogleCalendarStatus | null>(null);
  const [tokens, setTokens] = useState<Tokens>({});
  const [knowledge, setKnowledge] = useState<KnowledgeLinks>({ drive: "", notion: "" });

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json())
      .then((d: Health) => setHealth(d))
      .catch(() => setHealth(null));
    void fetch("/api/calendar")
      .then((r) => r.json())
      .then((d: { google?: GoogleCalendarStatus }) => setGcal(d.google ?? null))
      .catch(() => setGcal(null));
    try {
      setTokens(JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "{}") as Tokens);
    } catch {
      setTokens({});
    }
    setKnowledge(readKnowledgeForm());
  }, []);

  function saveToken(id: string, value: string) {
    const next = { ...tokens, [id]: value };
    setTokens(next);
    localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
  }

  function connected(id: string) {
    if (id === "gmail") return Boolean(health?.gmailConnected);
    if (id === "gcal") return Boolean(gcal?.connected);
    if (id === "slack") return Boolean(health?.slack);
    if (id === "m365") return Boolean(health?.microsoft?.connectedEmail);
    if (id === "twilio") return Boolean(health?.twilio?.configured);
    return Boolean(tokens[id]);
  }

  function statusLabel(id: string) {
    // Twilio credentials being present is not proof Twilio accepts them; only a real send says that.
    if (id === "twilio") return health?.twilio?.configured ? "Credentials set" : "Not connected";
    return connected(id) ? "Connected" : "Not connected";
  }

  const usage = health?.aiUsage;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gmail and Microsoft 365 connect with OAuth. Drive and Notion links are attached when you press Attach company file. SLA also posts to Slack, Teams, SMS, or B2B_WEBHOOK_URL when those secrets are on the server.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <section key={card.id} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{card.name}</h2>
              <span className={connected(card.id) ? "text-xs text-emerald-500" : "text-xs text-amber-500"}>{statusLabel(card.id)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
            {card.id === "gmail" ? (
              <a href={health?.oauthConfigured ? "/api/auth/gmail/start" : "/settings"} className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                {health?.gmailConnected ? "Reconnect" : "Connect Gmail"}
              </a>
            ) : card.id === "gcal" ? (
              <div className="mt-3 space-y-2">
                {gcal?.error ? <p className="text-xs text-amber-500">{gcal.error}</p> : null}
                {gcal?.connected ? (
                  <p className="text-xs text-muted-foreground">Google answered with {gcal.count} upcoming events.</p>
                ) : (
                  <a href={health?.oauthConfigured ? "/api/auth/gmail/start" : "/settings"} className="inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                    {health?.gmailConnected ? "Reconnect Google to allow Calendar" : "Connect Google"}
                  </a>
                )}
              </div>
            ) : card.id === "m365" ? (
              <a href="/api/auth/microsoft/start" className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                {health?.microsoft?.connectedEmail ? health.microsoft.connectedEmail : "Connect Microsoft 365"}
              </a>
            ) : card.id === "slack" ? (
              <a href="/settings" className="mt-3 inline-block text-xs font-semibold text-accent">
                {health?.slack ? "Webhook saved" : "Add Slack webhook"}
              </a>
            ) : card.id === "twilio" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {health?.twilio?.configured
                  ? `Sender number ending ${health.twilio.from}. Nothing has been sent until you confirm a message.`
                  : "Set the three Twilio variables in the server environment (Vercel → Settings → Environment Variables)."}
              </p>
            ) : (
              <input
                type="password"
                value={tokens[card.id] ?? ""}
                placeholder="Paste token"
                onChange={(e) => saveToken(card.id, e.target.value)}
                className="mt-3 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs"
              />
            )}
          </section>
        ))}
      </div>
      <section className="mt-6 glass-panel rounded-xl p-4">
        <h2 className="text-sm font-semibold">Claude usage · estimated</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tokens reported by Anthropic for triage, drafts and Ask Helix, priced with list-price estimates. Counted on this server instance since{" "}
          {usage ? new Date(usage.since).toLocaleString() : "—"}; the cron runs on its own instance and reports its cost in its own response.
        </p>
        {usage ? (
          <div className="mt-3 flex flex-wrap gap-6 text-xs">
            <p>
              <span className="text-muted-foreground">Calls</span> <span className="font-semibold">{usage.calls}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Tokens in / out</span>{" "}
              <span className="font-semibold">
                {usage.inputTokens.toLocaleString()} / {usage.outputTokens.toLocaleString()}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Estimated cost</span> <span className="font-semibold">{usd(usage.estimatedUsd)}</span>
            </p>
            {Object.entries(usage.byPurpose).map(([purpose, p]) => (
              <p key={purpose} className="text-muted-foreground">
                {purpose}: {p.calls} · {usd(p.estimatedUsd)}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No usage data.</p>
        )}
      </section>
      <section className="mt-6 glass-panel rounded-xl p-4">
        <h2 className="text-sm font-semibold">Company files</h2>
        <p className="mt-1 text-xs text-muted-foreground">Paste the official Drive or Notion URL. Attach company file adds it to the draft next to the desk pricing file.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Google Drive
            <input
              value={knowledge.drive}
              placeholder="https://drive.google.com/..."
              onChange={(e) => {
                const next = { ...knowledge, drive: e.target.value };
                setKnowledge(next);
                localStorage.setItem(KNOWLEDGE_LINKS_KEY, JSON.stringify(next));
              }}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-normal normal-case"
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground uppercase">
            Notion
            <input
              value={knowledge.notion}
              placeholder="https://www.notion.so/..."
              onChange={(e) => {
                const next = { ...knowledge, notion: e.target.value };
                setKnowledge(next);
                localStorage.setItem(KNOWLEDGE_LINKS_KEY, JSON.stringify(next));
              }}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-normal normal-case"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
