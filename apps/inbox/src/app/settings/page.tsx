"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import type { CustomRule, DraftTone, EmailTemplate, UserPreferences } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KEYS_INBOX } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";

type GmailAccountRow = {
  id: string;
  emailAddress: string;
  connected: boolean;
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
};

type GmailAccountStatus = {
  oauthConfigured: boolean;
  accounts: GmailAccountRow[];
};

function GmailConnectCard() {
  return (
    <Suspense fallback={<div className="glass-panel rounded-xl p-6" />}>
      <GmailConnectCardInner />
    </Suspense>
  );
}

function GmailConnectCardInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GmailAccountStatus | null>(null);

  useEffect(() => {
    void fetch("/api/gmail-account")
      .then((r) => r.json())
      .then((d: GmailAccountStatus) => setStatus(d));
  }, []);

  const connectedNotice = searchParams.get("gmail_connected");
  const errorNotice = searchParams.get("gmail_error");

  return (
    <div className="glass-panel rounded-xl p-6">
      <h2 className="mb-1 text-base font-semibold text-foreground">Gmail mailboxes</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Connect one or more refreshable OAuth mailboxes — a shared alias like ops@ or support@ can be
        connected alongside a personal inbox. Sync pulls from every connected mailbox; replies always go
        out from the mailbox that received the thread.
      </p>
      {connectedNotice ? (
        <p className="mb-3 rounded-md border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-400">
          Connected {connectedNotice}.
        </p>
      ) : null}
      {errorNotice ? (
        <p className="mb-3 rounded-md border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          Could not connect: {errorNotice}
        </p>
      ) : null}
      {status == null ? (
        <p className="text-xs text-muted-foreground">Checking…</p>
      ) : !status.oauthConfigured ? (
        <p className="text-xs text-amber-500">
          Paste GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET above first.
        </p>
      ) : (
        <div className="space-y-3">
          {status.accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No mailboxes connected yet.</p>
          ) : (
            <ul className="space-y-2">
              {status.accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-foreground">{a.emailAddress}</p>
                    <p className="text-muted-foreground">
                      {a.hasRefreshToken ? "Refreshes automatically." : "No refresh token — reconnect to enable auto-refresh."}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      a.connected ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                    )}
                  >
                    {a.connected ? "Connected" : "Reconnect needed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/api/auth/gmail/start"
            className="btn-tactile inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            {status.accounts.length === 0 ? "Connect Gmail" : "Connect another mailbox"}
          </a>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState({
    autoTriage: true,
    defaultTone: "professional" as DraftTone,
    vipText: "",
    customRules: [] as CustomRule[],
    templates: [] as EmailTemplate[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/preferences")
      .then((r) => r.json())
      .then((d: { preferences?: UserPreferences }) => {
        const p = d.preferences;
        if (p) {
          setPreferences({
            autoTriage: p.autoTriage,
            defaultTone: p.defaultTone,
            vipText: (p.vipSenders ?? []).join("\n"),
            customRules: p.customRules ?? [],
            templates: p.templates ?? [],
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const vip_senders = preferences.vipText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auto_triage: preferences.autoTriage,
        default_tone: preferences.defaultTone,
        vip_senders,
        theme,
        customRules: preferences.customRules,
        templates: preferences.templates,
      }),
    });
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Paste API keys, then configure inbox preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="glass-panel rounded-xl p-6">
          <ApiKeysForm initialFields={KEYS_INBOX} />
        </div>
        <GmailConnectCard />
        <div className="glass-panel rounded-xl p-6">
          <DeskOpsForm />
        </div>
        <div className="glass-panel rounded-xl p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">Appearance</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { id: "dark" as const, label: "Dark", swatch: "bg-[#0B0F1A] border-[#6366F1]/50" },
                { id: "light" as const, label: "Light", swatch: "bg-[#FAFAFA] border-[#4F46E5]/40" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  theme === opt.id
                    ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                    : "border-border hover:bg-surface-muted"
                )}
              >
                <div className={cn("mb-2 h-10 rounded-md border", opt.swatch)} />
                <div className="text-sm font-medium text-foreground">{opt.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">AI Triage</h2>
          <div className="flex items-center justify-between border-b border-border py-3">
            <div>
              <div className="text-sm text-foreground">Auto-triage incoming emails</div>
              <div className="text-xs text-muted-foreground">Classify and draft replies automatically</div>
            </div>
            <button
              type="button"
              aria-pressed={preferences.autoTriage}
              onClick={() => setPreferences({ ...preferences, autoTriage: !preferences.autoTriage })}
              className={`h-6 w-11 rounded-full transition-colors ${
                preferences.autoTriage ? "bg-accent" : "bg-[#374151]"
              }`}
            >
              <div
                className={`size-5 rounded-full bg-white transition-transform ${
                  preferences.autoTriage ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="py-3">
            <div className="mb-2 text-sm text-foreground">Default reply tone</div>
            <select
              value={preferences.defaultTone}
              onChange={(e) =>
                setPreferences({ ...preferences, defaultTone: e.target.value as DraftTone })
              }
              className="input-glow rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Direct</option>
              <option value="formal">Formal</option>
            </select>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">VIP Senders</h2>
          <textarea
            value={preferences.vipText}
            onChange={(e) => setPreferences({ ...preferences, vipText: e.target.value })}
            placeholder={"ceo@company.com\nvip@client.com"}
            rows={3}
            className="input-glow w-full resize-none rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Custom rules</h2>
            <button
              type="button"
              className="text-xs font-medium text-accent"
              onClick={() =>
                setPreferences({
                  ...preferences,
                  customRules: [
                    ...preferences.customRules,
                    {
                      id: `rule-${Date.now().toString(36)}`,
                      ifContains: "",
                      then: "review",
                      enabled: true,
                    },
                  ],
                })
              }
            >
              + Add rule
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            If subject/body contains X, then apply an action (e.g. amount &gt; hint: use “1000”).
          </p>
          <div className="space-y-3">
            {preferences.customRules.map((rule, i) => (
              <div key={rule.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_140px_auto]">
                <input
                  value={rule.ifContains}
                  onChange={(e) => {
                    const customRules = [...preferences.customRules];
                    customRules[i] = { ...rule, ifContains: e.target.value };
                    setPreferences({ ...preferences, customRules });
                  }}
                  placeholder="If contains…"
                  className="input-glow rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-foreground"
                />
                <select
                  value={rule.then}
                  onChange={(e) => {
                    const customRules = [...preferences.customRules];
                    customRules[i] = { ...rule, then: e.target.value as CustomRule["then"] };
                    setPreferences({ ...preferences, customRules });
                  }}
                  className="input-glow rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="urgent">Mark urgent</option>
                  <option value="vip_route">VIP route</option>
                  <option value="review">Force review</option>
                  <option value="block">Block</option>
                </select>
                <button
                  type="button"
                  className="text-xs text-red-500"
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      customRules: preferences.customRules.filter((r) => r.id !== rule.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {preferences.customRules.length === 0 ? (
              <p className="text-xs text-muted-foreground">No rules yet.</p>
            ) : null}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Reply templates</h2>
            <button
              type="button"
              className="text-xs font-medium text-accent"
              onClick={() =>
                setPreferences({
                  ...preferences,
                  templates: [
                    ...preferences.templates,
                    { id: `tpl-${Date.now().toString(36)}`, name: "New template", body: "" },
                  ],
                })
              }
            >
              + Add template
            </button>
          </div>
          <div className="space-y-3">
            {preferences.templates.map((tpl, i) => (
              <div key={tpl.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <input
                    value={tpl.name}
                    onChange={(e) => {
                      const templates = [...preferences.templates];
                      templates[i] = { ...tpl, name: e.target.value };
                      setPreferences({ ...preferences, templates });
                    }}
                    className="input-glow flex-1 rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() =>
                      setPreferences({
                        ...preferences,
                        templates: preferences.templates.filter((t) => t.id !== tpl.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={tpl.body}
                  rows={2}
                  onChange={(e) => {
                    const templates = [...preferences.templates];
                    templates[i] = { ...tpl, body: e.target.value };
                    setPreferences({ ...preferences, templates });
                  }}
                  className="input-glow w-full resize-none rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-foreground"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="btn-tactile rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
