"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { KEYS_MARKETING } from "@helix/core/secret-fields";
import { loadJson, saveJson } from "@/lib/desk-prefs";
import { cn } from "@/lib/utils";

type KeyField = { name: string; label: string; hint: string; stub?: boolean };
type KeyRow = KeyField & { configured: boolean; masked: string | null };

type RuntimeStatus = {
  meta: boolean;
  google: boolean;
  tiktok?: boolean;
  csv: boolean;
  store?: string;
  unmatched?: number;
  metaWrites?: boolean;
};

type DeskStatus = { empty?: boolean; demo?: boolean; store?: string; count?: number };

type CidrEntry = { cidr: string; label: string };

type SettingsLocal = {
  events: Record<string, boolean>;
  cidrs: CidrEntry[];
  mtls: boolean;
  webauthn: boolean;
  webhookUrl: string;
};

const EVENT_DEFS = [
  {
    id: "ad_spend.anomaly_detected",
    blurb: "Triggered when CTR drops >35% in 1hr",
  },
  {
    id: "hitl.review_mandated",
    blurb: "When optimization change exceeds $5k/day",
  },
  {
    id: "token.expiring_soon",
    blurb: "Fires 7 days before OAuth refresh validity",
  },
  {
    id: "capi.payload_dropped",
    blurb: "Alerts on malformed UTM or schema mismatch",
  },
] as const;

const DEFAULT_LOCAL: SettingsLocal = {
  events: {
    "ad_spend.anomaly_detected": true,
    "hitl.review_mandated": true,
    "token.expiring_soon": true,
    "capi.payload_dropped": true,
  },
  cidrs: [
    { cidr: "198.51.100.0/24", label: "Production Ingestion VPC (AWS us-east-1)" },
    { cidr: "203.0.113.45/32", label: "Corporate Office Static Gateway" },
  ],
  mtls: true,
  webauthn: true,
  webhookUrl: "https://api.helix.marketing/v1/webhooks/ingress/iad1",
};

type TabId = "keys" | "oauth" | "webhooks" | "quotas" | "security";

const PLATFORM_KEYS = new Set([
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
]);

function loadLocal(): SettingsLocal {
  return loadJson("settings.guardrails", DEFAULT_LOCAL);
}

function saveLocal(v: SettingsLocal) {
  saveJson("settings.guardrails", v);
}

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className={cn(
        "relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
        enabled
          ? "bg-primary-container shadow-[0_0_10px_rgba(249,115,22,0.35)]"
          : "bg-surface-container-highest"
      )}
    >
      <span
        className={cn(
          "size-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function MetricCard({
  label,
  icon,
  accent,
  children,
}: {
  label: string;
  icon: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface-container-low p-4 shadow-lg transition-all hover:border-white/[0.12]">
      <div
        className="absolute top-0 right-0 left-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
      <div className="flex items-center justify-between text-xs text-on-surface-variant">
        <span>{label}</span>
        <span className="material-symbols-outlined text-[18px]" style={{ color: accent }}>
          {icon}
        </span>
      </div>
      {children}
    </div>
  );
}

export function SettingsKeysDesk() {
  const [tab, setTab] = useState<TabId>("keys");
  const [keys, setKeys] = useState<KeyRow[]>(() =>
    KEYS_MARKETING.map((f) => ({ ...f, configured: false, masked: null }))
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [persist, setPersist] = useState("");
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [desk, setDesk] = useState<DeskStatus | null>(null);
  const [local, setLocal] = useState<SettingsLocal>(DEFAULT_LOCAL);
  const [cidrDraft, setCidrDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [operator, setOperator] = useState({ configured: false, unlocked: false });
  const [opKey, setOpKey] = useState("");

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/settings/keys");
    const data = (await res.json()) as { keys?: KeyRow[]; persist?: string };
    setKeys(data.keys ?? []);
    setPersist(data.persist ?? "");
  }, []);

  const loadRuntime = useCallback(async () => {
    const res = await fetch("/api/status");
    if (!res.ok) return;
    setRuntime((await res.json()) as RuntimeStatus);
  }, []);

  const loadDesk = useCallback(async () => {
    const res = await fetch("/api/settings/desk");
    if (!res.ok) return;
    setDesk((await res.json()) as DeskStatus);
  }, []);

  const loadOperator = useCallback(async () => {
    const res = await fetch("/api/operator");
    if (!res.ok) return;
    const data = (await res.json()) as { configured?: boolean; operator?: boolean };
    setOperator({ configured: Boolean(data.configured), unlocked: Boolean(data.operator) });
  }, []);

  useEffect(() => {
    setLocal(loadLocal());
    void loadKeys();
    void loadRuntime();
    void loadDesk();
    void loadOperator();
  }, [loadKeys, loadRuntime, loadDesk, loadOperator]);

  const configuredCount = useMemo(() => keys.filter((k) => k.configured).length, [keys]);
  const developerKeys = useMemo(
    () =>
      keys.filter(
        (k) => !PLATFORM_KEYS.has(k.name) && k.name !== "SLACK_WEBHOOK_URL"
      ),
    [keys]
  );
  const metaToken = keys.find((k) => k.name === "META_ACCESS_TOKEN");
  const metaAccount = keys.find((k) => k.name === "META_AD_ACCOUNT_ID");
  const googleTok = keys.find((k) => k.name === "GOOGLE_ADS_DEVELOPER_TOKEN");
  const slackKey = keys.find((k) => k.name === "SLACK_WEBHOOK_URL");

  function patchLocal(next: SettingsLocal) {
    setLocal(next);
    setDirty(true);
  }

  async function saveKeys(e?: FormEvent) {
    e?.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) {
      flash("Could not save keys.");
      return;
    }
    const data = (await res.json()) as { keys?: KeyRow[]; persist?: string };
    setKeys(data.keys ?? []);
    setPersist(data.persist ?? "");
    setDraft({});
    setRevealed({});
    saveLocal(local);
    setDirty(false);
    flash("Configuration saved · secrets stay on the desk.");
    void loadRuntime();
  }

  async function deskAction(action: "demo" | "empty") {
    setBusy(action);
    const res = await fetch("/api/settings/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (!res.ok) {
      flash("Desk update failed.");
      return;
    }
    setDesk((await res.json()) as DeskStatus);
    flash(action === "demo" ? "Demo catalog loaded." : "Desk cleared (local only).");
  }

  async function testMetaPing() {
    setBusy("meta-ping");
    const res = await fetch("/api/ads/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ window: "7d" }),
    });
    setBusy(null);
    const data = (await res.json()) as {
      error?: string;
      imported?: number;
      campaigns?: number;
      message?: string;
    };
    if (!res.ok) {
      flash(data.error ?? "Meta ping failed.");
      return;
    }
    flash(
      data.message ??
        `Meta OK · ${data.imported ?? 0} insight rows · ${data.campaigns ?? 0} campaigns.`
    );
    void loadRuntime();
  }

  async function unlockOperator(e: FormEvent) {
    e.preventDefault();
    setBusy("unlock");
    const res = await fetch("/api/operator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: opKey }),
    });
    setBusy(null);
    if (!res.ok) {
      flash("Unlock failed.");
      return;
    }
    setOpKey("");
    setOperator({ configured: true, unlocked: true });
    flash("Operator session unlocked.");
  }

  function copyText(text: string) {
    void navigator.clipboard?.writeText(text).then(() => flash("Copied."));
  }

  function addCidr() {
    const cidr = cidrDraft.trim();
    if (!cidr) return;
    patchLocal({
      ...local,
      cidrs: [...local.cidrs, { cidr, label: "Custom allowlist entry" }],
    });
    setCidrDraft("");
  }

  const storeLabel =
    runtime?.store === "supabase"
      ? "Supabase"
      : runtime?.store === "file"
        ? "Local file"
        : "In-memory";

  const tabs: { id: TabId; label: string; icon: string; badge?: string }[] = [
    { id: "keys", label: "API Keys & Access Tokens", icon: "key", badge: String(configuredCount) },
    {
      id: "oauth",
      label: "OAuth Connected Accounts",
      icon: "hub",
      badge: runtime?.meta ? "1 Active" : "0 Active",
    },
    { id: "webhooks", label: "Webhooks & Endpoints", icon: "webhook" },
    { id: "quotas", label: "Rate Limits & Quotas", icon: "tune" },
    {
      id: "security",
      label: "Security & IP Allowlist",
      icon: "lock",
      badge: `${local.cidrs.length} CIDRs`,
    },
  ];

  function KeyEditor({ row }: { row: KeyRow }) {
    const open = revealed[row.name];
    const draftVal = draft[row.name] ?? "";
    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-white/[0.08] bg-obsidian-base p-3.5 transition-all hover:border-white/[0.12]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                row.configured
                  ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                  : row.stub
                    ? "bg-amber-400"
                    : "bg-slate-500"
              )}
            />
            <span className="text-xs font-semibold text-white">{row.label}</span>
            {row.stub ? (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300 border border-amber-500/20">
                STUB
              </span>
            ) : null}
          </div>
          <span
            className={cn(
              "font-mono text-[10px]",
              row.configured ? "text-emerald-400" : "text-on-surface-variant"
            )}
          >
            {row.configured ? `Saved ${row.masked}` : "Not set"}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#0b0d13] px-2 py-1.5 font-mono text-xs">
          <input
            autoComplete="off"
            spellCheck={false}
            type={open ? "text" : "password"}
            className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600"
            placeholder={
              row.configured ? "••••••••  (leave blank to keep)" : `Paste ${row.name}`
            }
            value={draftVal}
            onChange={(e) => {
              setDraft((d) => ({ ...d, [row.name]: e.target.value }));
              setDirty(true);
            }}
          />
          <button
            type="button"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            title="Copy name"
            onClick={() => copyText(row.name)}
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
          </button>
          <button
            type="button"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            title="Toggle visibility"
            onClick={() => setRevealed((r) => ({ ...r, [row.name]: !r[row.name] }))}
          >
            <span className="material-symbols-outlined text-[16px]">
              {open ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-on-surface-variant">
          {row.hint}
          {row.stub ? " · Saving does not enable live writes this sprint." : ""}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
            {row.name}
          </span>
          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              className="rounded px-2 py-1 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
              onClick={() => {
                setRevealed((r) => ({ ...r, [row.name]: true }));
                flash("Paste a new value, then Save.");
              }}
            >
              Rotate
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              onClick={() => {
                setDraft((d) => ({ ...d, [row.name]: "" }));
                flash("Clear on save is not supported — remove from env / vault.");
              }}
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-8 pb-32 lg:px-8">
      <div className="pointer-events-none fixed top-24 right-1/4 -z-10 h-96 w-96 rounded-full bg-primary-container/5 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-24 left-1/3 -z-10 h-80 w-80 rounded-full bg-cyan-500/5 blur-[120px]" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Settings &amp; API Keys</h1>
            <span className="rounded-md border border-primary-container/30 bg-primary-container/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-marketing-amber">
              v4.2-STABLE
            </span>
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              {runtime?.meta ? "META LIVE · Insights + HITL write" : "META OFFLINE · paste token"}
            </div>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
            Cryptographic API credentials, Meta / Google write tokens, inbound webhooks, and desk
            guardrails. Secrets stay on the server — empty fields keep the current value.
            {persist ? ` Store: ${persist}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busy === "meta-ping"}
            onClick={() => void testMetaPing()}
            className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-surface-container-low px-3.5 text-xs font-medium text-slate-200 shadow-sm transition-all hover:bg-surface-container-high disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-400">sync_lock</span>
            {busy === "meta-ping" ? "Pinging…" : "Test Meta Sync"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("keys");
              document.getElementById("settings-keys-anchor")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-4 text-xs font-semibold text-on-primary-container shadow-[0_0_20px_rgba(249,115,22,0.35)] transition-all hover:brightness-110 hover:scale-[1.01]"
          >
            <span className="material-symbols-outlined text-[17px] font-bold">add</span>
            Generate / Paste Key
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Keys & Tokens" icon="vpn_key" accent="#f97316">
          <div className="flex items-baseline justify-between pt-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-white">{configuredCount}</span>
              <span className="font-mono text-xs text-on-surface-variant uppercase">
                / {keys.length}
              </span>
            </div>
            <span className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] text-marketing-amber">
              {runtime?.meta ? "Meta live" : "Meta off"}
            </span>
          </div>
          <div className="flex items-center justify-between pt-3 font-mono text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Desk {storeLabel}
            </span>
            <svg className="h-4 w-14 text-primary-container" fill="none" viewBox="0 0 64 16">
              <path
                d="M0 13 L12 11 L24 13 L36 6 L48 8 L64 3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </MetricCard>

        <MetricCard label="Connector Health" icon="data_usage" accent="#22d3ee">
          <div className="flex items-baseline justify-between pt-2">
            <span className="font-mono text-2xl font-bold text-white">
              {[runtime?.meta, runtime?.csv].filter(Boolean).length}
              <span className="text-sm text-on-surface-variant"> / 3</span>
            </span>
            <span className="font-mono text-xs font-semibold text-cyan-400">
              {runtime?.meta ? "LIVE" : "PARTIAL"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 pt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-[#0b0d13]">
              <div
                className="h-full rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                style={{
                  width: `${(([runtime?.meta, runtime?.csv, false].filter(Boolean).length) / 3) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-on-surface-variant">
              <span>CSV always on</span>
              <span>Google stub</span>
            </div>
          </div>
        </MetricCard>

        <MetricCard label="Join Queue Depth" icon="speed" accent="#34d399">
          <div className="flex items-baseline justify-between pt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">
                {runtime?.unmatched ?? "—"}
              </span>
              <span className="font-mono text-xs text-on-surface-variant">unmatched</span>
            </div>
            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
              30d
            </span>
          </div>
          <div className="flex items-center justify-between pt-3 font-mono text-[11px] text-on-surface-variant">
            <a href="/unmatched" className="text-cyan-400 hover:underline">
              Open join queue →
            </a>
          </div>
        </MetricCard>

        <MetricCard label="Desk Catalog" icon="verified_user" accent="#fb923c">
          <div className="flex items-baseline justify-between pt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">{desk?.count ?? "—"}</span>
              <span className="font-mono text-xs text-on-surface-variant">rows</span>
            </div>
            <span className="rounded border border-white/[0.08] bg-surface-container-high px-2 py-0.5 font-mono text-[10px] text-slate-300">
              {desk?.demo ? "demo" : desk?.empty ? "empty" : "live"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-3 font-mono text-[11px]">
            <button
              type="button"
              disabled={busy === "demo"}
              onClick={() => void deskAction("demo")}
              className="text-marketing-amber hover:underline disabled:opacity-50"
            >
              Load demo
            </button>
            <button
              type="button"
              disabled={busy === "empty"}
              onClick={() => void deskAction("empty")}
              className="text-rose-400 hover:underline disabled:opacity-50"
            >
              Clear desk
            </button>
          </div>
        </MetricCard>
      </div>

      {/* Tabs */}
      <div className="mb-2 flex items-center gap-1 overflow-x-auto border-b border-white/[0.08] pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 py-2 text-xs transition-colors",
              tab === t.id
                ? "border-b-2 border-primary-container bg-primary-container/10 font-medium text-primary-container"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-slate-200"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            <span>{t.label}</span>
            {t.badge ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                  tab === t.id
                    ? "bg-primary-container/20 text-marketing-amber"
                    : "bg-surface-container-highest text-slate-300"
                )}
              >
                {t.badge}
              </span>
            ) : t.id === "webhooks" ? (
              <span className="size-1.5 rounded-full bg-emerald-400" />
            ) : null}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => void saveKeys(e)} className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left column */}
        <div className="flex flex-col gap-6 xl:col-span-7">
          {(tab === "keys" || tab === "oauth") && (
            <section
              id="settings-keys-anchor"
              className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-container-low p-5 shadow-xl"
            >
              <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-primary-container/70 to-transparent" />
              <div className="flex flex-col justify-between gap-2 border-b border-white/[0.08] pb-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary-container">
                      terminal
                    </span>
                    <h2 className="text-sm font-bold tracking-tight text-white">
                      Helix Developer API Keys
                    </h2>
                  </div>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">
                    Anthropic, Supabase, operator lock, Slack, and cron — paste instead of editing
                    .env.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded border border-white/[0.08] bg-[#0b0d13] px-2 py-1 font-mono text-[10px] text-slate-300">
                  <span className="material-symbols-outlined text-[14px] text-cyan-400">lock</span>
                  Desk secret vault
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {developerKeys.map((row) => (
                  <KeyEditor key={row.name} row={row} />
                ))}
              </div>
            </section>
          )}

          {(tab === "keys" || tab === "webhooks") && (
            <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-container-low p-5 shadow-xl">
              <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-cyan-500/70 to-transparent" />
              <div className="flex flex-col justify-between gap-2 border-b border-white/[0.08] pb-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-cyan-400">
                      alt_route
                    </span>
                    <h2 className="text-sm font-bold tracking-tight text-white">
                      Webhook Ingress &amp; Event Subscriptions
                    </h2>
                  </div>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">
                    Slack brief destination and local event subscription prefs (desk-side).
                  </p>
                </div>
                <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                  {slackKey?.configured ? "Slack set" : "Slack unset"}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                  Ingress Endpoint (display)
                </label>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#0b0d13] px-3 py-2 font-mono text-xs">
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      POST
                    </span>
                    <span className="truncate text-cyan-300">{local.webhookUrl}</span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => copyText(local.webhookUrl)}
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>

              {slackKey ? <KeyEditor row={slackKey} /> : null}

              <div className="flex flex-col gap-2 pt-1">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                  Active Event Subscriptions
                </span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {EVENT_DEFS.map((ev) => (
                    <label
                      key={ev.id}
                      className="flex cursor-pointer select-none items-start gap-2.5 rounded-lg border border-white/[0.08] bg-obsidian-base p-2.5 transition-colors hover:border-white/[0.12]"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-white/20 bg-[#0b0d13] text-primary-container focus:ring-0 focus:ring-offset-0"
                        checked={Boolean(local.events[ev.id])}
                        onChange={(e) =>
                          patchLocal({
                            ...local,
                            events: { ...local.events, [ev.id]: e.target.checked },
                          })
                        }
                      />
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-slate-200">{ev.id}</span>
                        <span className="mt-0.5 text-[10px] text-on-surface-variant">{ev.blurb}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "quotas" && (
            <section className="rounded-xl border border-white/[0.08] bg-surface-container-low p-5 shadow-xl">
              <h2 className="text-sm font-bold text-white">Rate Limits &amp; Quotas</h2>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Meta Insights pulls use your ad account rate limits. CSV ingest has no hard quota on
                this desk. Google Ads remains stub this sprint.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Meta Insights", value: runtime?.meta ? "Enabled" : "Needs token", tone: runtime?.meta ? "text-emerald-400" : "text-amber-300" },
                  { label: "HITL write-back", value: runtime?.metaWrites ? "ads_management" : "Read-only / off", tone: runtime?.metaWrites ? "text-emerald-400" : "text-slate-400" },
                  { label: "CSV / JSON ingest", value: "Always on", tone: "text-cyan-400" },
                  { label: "Google Ads API", value: "Stub — use CSV", tone: "text-amber-300" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg border border-white/[0.08] bg-obsidian-base p-3"
                  >
                    <p className="text-[10px] text-on-surface-variant">{row.label}</p>
                    <p className={cn("mt-1 font-mono text-sm font-semibold", row.tone)}>{row.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          {(tab === "keys" || tab === "oauth") && (
            <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-container-low p-5 shadow-xl">
              <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-amber-500/70 to-transparent" />
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-marketing-amber">
                    sync_alt
                  </span>
                  <h2 className="text-sm font-bold tracking-tight text-white">
                    Ad Platform Write Credentials
                  </h2>
                </div>
                <span className="font-mono text-[10px] text-on-surface-variant">v20.0 CAPI</span>
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-white/[0.08] bg-obsidian-base p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-6 items-center justify-center rounded-md border border-[#1877F2]/40 bg-[#1877F2]/20">
                      <span className="size-2.5 rounded-full bg-[#1877F2] shadow-[0_0_6px_#1877F2]" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-white">Meta Marketing API</p>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            runtime?.meta ? "bg-emerald-400" : "bg-slate-500"
                          )}
                        />
                        {runtime?.meta ? "System User Token Active" : "Not configured"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded border px-2 py-0.5 font-mono text-[10px]",
                      runtime?.meta
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "border-white/[0.08] bg-surface-container-high text-slate-400"
                    )}
                  >
                    {runtime?.meta ? "LIVE" : "OFF"}
                  </span>
                </div>
                {metaToken ? <KeyEditor row={metaToken} /> : null}
                {metaAccount ? <KeyEditor row={metaAccount} /> : null}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <div className="flex gap-1">
                    <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                      ads_management
                    </span>
                    <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                      insights
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy === "meta-ping"}
                      onClick={() => void testMetaPing()}
                      className="font-medium text-marketing-amber hover:underline disabled:opacity-50"
                    >
                      Test Ping
                    </button>
                    <span className="text-slate-600">·</span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white"
                      onClick={() => flash("Paste a new Meta token, then Save.")}
                    >
                      Rotate
                    </button>
                  </div>
                </div>
              </div>

              {/* Google */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-white/[0.08] bg-obsidian-base p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-6 items-center justify-center rounded-md border border-primary-container/40 bg-primary-container/20">
                      <span className="size-2.5 rounded-full bg-primary-container shadow-[0_0_6px_#f97316]" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-white">Google Ads API</p>
                      <p className="mt-0.5 font-mono text-[10px] text-on-surface-variant">
                        Stub this sprint — use CSV ingest
                      </p>
                    </div>
                  </div>
                  <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                    STUB
                  </span>
                </div>
                {googleTok ? <KeyEditor row={googleTok} /> : null}
              </div>

              {/* TikTok visual */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-white/[0.08] bg-obsidian-base p-3.5 opacity-80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-6 items-center justify-center rounded-md border border-slate-700 bg-slate-800">
                      <span className="size-2.5 rounded-full bg-slate-200" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-white">TikTok Business API</p>
                      <p className="mt-0.5 font-mono text-[10px] text-cyan-400">Coming soon</p>
                    </div>
                  </div>
                  <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                    ROADMAP
                  </span>
                </div>
              </div>
            </section>
          )}

          {(tab === "keys" || tab === "security") && (
            <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-container-low p-5 shadow-xl">
              <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-emerald-500/70 to-transparent" />
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-400">
                    verified_user
                  </span>
                  <h2 className="text-sm font-bold tracking-tight text-white">
                    IP Whitelist &amp; Enclave Guardrails
                  </h2>
                </div>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                  DESK
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                  Authorized IPv4/IPv6 CIDRs
                </label>
                {local.cidrs.map((c, i) => (
                  <div
                    key={`${c.cidr}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-obsidian-base px-3 py-2"
                  >
                    <div className="font-mono">
                      <p className="text-xs font-semibold text-white">{c.cidr}</p>
                      <p className="text-[10px] text-on-surface-variant">{c.label}</p>
                    </div>
                    <button
                      type="button"
                      className="p-1 text-slate-500 transition-colors hover:text-rose-400"
                      onClick={() =>
                        patchLocal({
                          ...local,
                          cidrs: local.cidrs.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    className="h-8 flex-1 rounded-lg border border-white/[0.08] bg-[#0b0d13] px-3 font-mono text-xs text-white outline-none placeholder:text-slate-500 focus:border-primary-container"
                    placeholder="e.g. 192.0.2.0/24"
                    value={cidrDraft}
                    onChange={(e) => setCidrDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCidr();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addCidr}
                    className="flex h-8 items-center gap-1 rounded-lg border border-white/[0.1] bg-surface-container-high px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-surface-container-highest"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Add CIDR
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-obsidian-base p-3">
                  <div className="pr-3">
                    <p className="text-xs font-medium text-white">Enforce Mutual TLS (mTLS)</p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant">
                      Desk preference — enforce client certs when edge proxy supports it
                    </p>
                  </div>
                  <Toggle
                    enabled={local.mtls}
                    onToggle={() => patchLocal({ ...local, mtls: !local.mtls })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-obsidian-base p-3">
                  <div className="pr-3">
                    <p className="text-xs font-medium text-white">Require Hardware WebAuthn / FIDO2</p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant">
                      Prefer hardware prompt before revealing pasted secrets
                    </p>
                  </div>
                  <Toggle
                    enabled={local.webauthn}
                    onToggle={() => patchLocal({ ...local, webauthn: !local.webauthn })}
                  />
                </div>
              </div>

              {/* Operator unlock */}
              <div className="rounded-lg border border-white/[0.08] bg-obsidian-base p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-white">Operator session</p>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      operator.unlocked ? "text-emerald-400" : "text-amber-300"
                    )}
                  >
                    {operator.unlocked ? "UNLOCKED" : operator.configured ? "LOCKED" : "OPTIONAL"}
                  </span>
                </div>
                {!operator.unlocked ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      className="h-8 flex-1 rounded-lg border border-white/[0.08] bg-[#0b0d13] px-3 font-mono text-xs text-white outline-none"
                      placeholder="HELIX_OPERATOR_KEY"
                      value={opKey}
                      onChange={(e) => setOpKey(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy === "unlock" || !opKey}
                      onClick={(e) => void unlockOperator(e as unknown as FormEvent)}
                      className="h-8 rounded-lg bg-primary-container px-3 text-xs font-semibold text-on-primary-container disabled:opacity-50"
                    >
                      Unlock
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-on-surface-variant">
                    HITL writes and Meta sync are allowed on this browser.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </form>

      {/* Floating save bar */}
      <div className="fixed right-6 bottom-4 left-[calc(16rem+1.5rem)] z-40 mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.1] bg-[#10131b]/95 px-5 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary-container/30 bg-primary-container/15">
              <span className="material-symbols-outlined text-[18px] text-primary-container">
                verified
              </span>
            </div>
            <div className="leading-tight">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-200">
                  Secrets encrypted at rest on the desk vault
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-[10px] font-bold text-emerald-400">
                  {dirty ? "Unsaved changes" : "Synchronized"}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-on-surface-variant">
                Guardrails (CIDR / events) save to this browser. API keys POST to /api/settings/keys.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {toast ? (
              <span className="max-w-xs truncate font-mono text-[10px] text-marketing-amber">
                {toast}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setDraft({});
                setLocal(loadLocal());
                setDirty(false);
                flash("Discarded drafts.");
              }}
              className="h-8 rounded-lg border border-white/[0.1] bg-surface-container-low px-3 text-xs text-slate-300 transition-colors hover:bg-surface-container-high hover:text-white"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveKeys()}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary-container px-4 text-xs font-semibold text-on-primary-container shadow-[0_0_16px_rgba(249,115,22,0.35)] transition-all hover:brightness-110 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              {saving ? "Saving…" : "Save & Deploy Configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
