"use client";

import { useEffect, useState } from "react";
import { KNOWLEDGE_LINKS_KEY, readKnowledgeForm, type KnowledgeLinks } from "@/lib/knowledge-links";

type Health = {
  gmailConnected: boolean;
  oauthConfigured: boolean;
  slack: boolean;
  teams: boolean;
  claude: boolean;
  microsoft?: { configured: boolean; connectedEmail: string | null };
};
const TOKEN_KEY = "helix-inbox-integration-tokens";

type Tokens = Record<string, string>;

const CARDS = [
  { id: "gmail", name: "Gmail", detail: "OAuth mailbox sync" },
  { id: "m365", name: "Microsoft 365", detail: "One-click OAuth. Needs Microsoft app credentials on the server." },
  { id: "slack", name: "Slack", detail: "SLA and weekly report webhook" },
  { id: "calendly", name: "Calendly", detail: "Upcoming meetings and the link for each one" },
  { id: "hubspot", name: "HubSpot", detail: "CRM note token" },
  { id: "salesforce", name: "Salesforce", detail: "CRM note token" },
];

export default function IntegrationsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [tokens, setTokens] = useState<Tokens>({});
  const [knowledge, setKnowledge] = useState<KnowledgeLinks>({ drive: "", notion: "" });

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json())
      .then((d: Health) => setHealth(d))
      .catch(() => setHealth(null));
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
    if (id === "slack") return Boolean(health?.slack);
    if (id === "m365") return Boolean(health?.microsoft?.connectedEmail);
    return Boolean(tokens[id]);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gmail and Microsoft 365 connect with OAuth. Drive and Notion links are attached when you press Attach company file. SLA also posts to Slack, Teams, SMS, or B2B_WEBHOOK_URL when those secrets are on the server.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <section key={card.id} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{card.name}</h2>
              <span className={connected(card.id) ? "text-xs text-emerald-500" : "text-xs text-amber-500"}>
                {connected(card.id) ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
            {card.id === "gmail" ? (
              <a href={health?.oauthConfigured ? "/api/auth/gmail/start" : "/settings"} className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                {health?.gmailConnected ? "Reconnect" : "Connect Gmail"}
              </a>
            ) : card.id === "m365" ? (
              <a href="/api/auth/microsoft/start" className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                {health?.microsoft?.connectedEmail ? health.microsoft.connectedEmail : "Connect Microsoft 365"}
              </a>
            ) : card.id === "slack" ? (
              <a href="/settings" className="mt-3 inline-block text-xs font-semibold text-accent">
                {health?.slack ? "Webhook saved" : "Add Slack webhook"}
              </a>
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
