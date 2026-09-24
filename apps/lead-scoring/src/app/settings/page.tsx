"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KEYS_LEADS } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";
import { DEFAULT_BRAND, readBrand, writeBrand } from "@/lib/prefs";
import { cn } from "@/lib/utils";

type Status = { claude: boolean; supabase: boolean; ghl: boolean };
type Org = {
  orgId: string;
  orgName: string;
  role: "owner" | "operator" | "viewer";
  webhookToken?: string;
  logoUrl?: string;
  primaryColor?: string;
};
type OrgInfo = {
  configured: boolean;
  signedIn: boolean;
  user?: { email: string | null };
  org?: Org | null;
};

const ROWS: { key: keyof Status; label: string; hint: string; icon: string }[] = [
  {
    key: "claude",
    label: "Claude / Anthropic",
    hint: "Structured JSON scoring when keyed — heuristic until then.",
    icon: "neurology",
  },
  {
    key: "supabase",
    label: "Supabase",
    hint: "Persists scored leads. Without it the desk is in-memory.",
    icon: "database",
  },
  {
    key: "ghl",
    label: "GoHighLevel",
    hint: "CRM push + inbound webhook. Mock handoff when offline.",
    icon: "hub",
  },
];

const QUICK_LINKS = [
  { href: "/settings/scoring", label: "Scoring Rules", icon: "tune", tone: "text-primary" },
  { href: "/settings/prompts", label: "Prompt Studio", icon: "terminal", tone: "text-secondary" },
  { href: "/settings/integrations", label: "Integrations", icon: "hub", tone: "text-tertiary" },
  { href: "/settings/automations", label: "Automations", icon: "alt_route", tone: "text-primary" },
  { href: "/settings/usage", label: "API & Webhooks", icon: "webhook", tone: "text-secondary" },
  { href: "/audit", label: "Audit Log", icon: "security", tone: "text-tertiary" },
];

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [logoDraft, setLogoDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("#06b6d4");
  const [productName, setProductName] = useState(DEFAULT_BRAND.productName);
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [origin, setOrigin] = useState("");

  function loadOrg() {
    return fetch("/api/org")
      .then((r) => r.json())
      .then((data: OrgInfo) => {
        setOrg(data);
        setLogoDraft(data.org?.logoUrl ?? "");
        setColorDraft(data.org?.primaryColor ?? "#06b6d4");
      });
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    const b = readBrand();
    setProductName(b.productName);
    if (b.logoUrl) setLogoDraft(b.logoUrl);
    if (b.primary) setColorDraft(b.primary);
    void fetch("/api/status")
      .then((r) => r.json())
      .then((data: Status) => setStatus(data));
    void loadOrg();
  }, []);

  async function saveBranding() {
    setBrandBusy(true);
    setBrandError(null);
    setBrandSaved(false);
    try {
      writeBrand({
        primary: colorDraft,
        logoUrl: logoDraft,
        productName: productName.trim() || DEFAULT_BRAND.productName,
      });
      if (org?.configured && org.signedIn && org.org?.role !== "viewer") {
        const res = await fetch("/api/org", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl: logoDraft, primaryColor: colorDraft }),
        });
        const data = (await res.json()) as OrgInfo & { error?: string };
        if (!res.ok) {
          setBrandError(data.error ?? "Could not save org branding");
          return;
        }
        setOrg(data);
      }
      setBrandSaved(true);
    } finally {
      setBrandBusy(false);
    }
  }

  const webhookUrl =
    org?.org?.webhookToken && origin
      ? `${origin}/api/leads/webhook/ghl/${org.org.webhookToken}`
      : null;
  const canEditBranding = !org?.configured || !org.signedIn || org.org?.role !== "viewer";
  const connectedCount = status
    ? ([status.claude, status.supabase, status.ghl] as boolean[]).filter(Boolean).length
    : 0;

  return (
    <main className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute -top-10 left-1/4 h-48 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-widest text-secondary uppercase">
              Desk Control Plane
            </span>
            <span className="size-1.5 animate-pulse rounded-full bg-tertiary" />
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
            Desk Settings
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Brand lockup, connector health, keys, and operator ops — status is real, not a pretend
            connector matrix.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary-container shadow-[0_0_16px_rgba(6,182,212,0.3)]"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            Manage API Keys
          </button>
          <Link
            href="/settings/usage"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs font-semibold text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">webhook</span>
            Ingest URLs
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="font-mono text-[10px] tracking-wider text-outline uppercase">Connectors</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">
            {status ? `${connectedCount}/3` : "—"}
          </p>
          <p className="font-mono text-[10px] text-on-surface-variant">live health</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="font-mono text-[10px] tracking-wider text-outline uppercase">Workspace</p>
          <p className="mt-1 truncate text-lg font-bold text-on-surface">
            {org?.org?.orgName ?? (org?.configured ? "Sign in" : "Local desk")}
          </p>
          <p className="font-mono text-[10px] text-on-surface-variant">
            {org?.user?.email ?? "browser session"}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="font-mono text-[10px] tracking-wider text-outline uppercase">Accent</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="size-6 rounded-md border border-outline-variant/40"
              style={{ background: colorDraft }}
            />
            <span className="font-mono text-sm font-semibold text-on-surface">{colorDraft}</span>
          </div>
        </div>
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="font-mono text-[10px] tracking-wider text-outline uppercase">Brand mark</p>
          <div className="mt-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoDraft || "/helix-leads-icon.png?v=legal1"}
              alt=""
              className="size-8 rounded-lg object-contain bg-surface-container"
            />
            <span className="font-mono text-[10px] text-on-surface-variant">
              {logoDraft ? "Custom URL" : "Official Helix mark"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Brand */}
        <div className="space-y-6 xl:col-span-5">
          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-xl">
            <div className="flex items-center gap-3 bg-surface-container p-4">
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/helix-leads-icon.png?v=legal1" alt="" className="size-9 object-contain" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Brand &amp; White-label</h2>
                <p className="font-mono text-[10px] text-on-surface-variant">
                  Electric cobalt / cyan mark · aqua #06b6d4 desk
                </p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-4 rounded-xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/helix-leads-wordmark.png?v=legal1"
                  alt="Helix for Leads"
                  className="h-12 w-auto max-w-full object-contain object-left"
                />
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-surface-container-lowest p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoDraft || "/helix-leads-icon.png?v=legal1"}
                  alt="Helix for Leads mark"
                  className="h-20 w-auto max-w-[5rem] object-contain drop-shadow-[0_0_14px_rgba(6,182,212,0.3)]"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-on-surface">{productName}</p>
                  <p className="font-mono text-[10px] tracking-wider text-outline uppercase">
                    Intelligent Engine
                  </p>
                </div>
              </div>

              <label className="block font-mono text-[10px] text-on-surface-variant">
                Product name
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  disabled={!canEditBranding}
                />
              </label>
              <label className="block font-mono text-[10px] text-on-surface-variant">
                Custom logo URL (optional — leave empty for official mark)
                <input
                  type="url"
                  className="mt-1 h-9 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary"
                  value={logoDraft}
                  onChange={(e) => setLogoDraft(e.target.value)}
                  placeholder="https://…/logo.png"
                  disabled={!canEditBranding}
                />
              </label>
              <div className="flex items-center gap-3">
                <label className="font-mono text-[10px] text-on-surface-variant">
                  Accent
                  <input
                    type="color"
                    value={colorDraft}
                    onChange={(e) => setColorDraft(e.target.value)}
                    className="mt-1 block h-9 w-14 cursor-pointer rounded-lg border border-outline-variant/40 bg-surface-container-lowest"
                    disabled={!canEditBranding}
                    aria-label="Primary color"
                  />
                </label>
                <button
                  type="button"
                  disabled={brandBusy || !canEditBranding}
                  onClick={() => void saveBranding()}
                  className="mt-4 h-9 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary-container disabled:opacity-50"
                >
                  {brandBusy ? "Saving…" : "Save branding"}
                </button>
                <button
                  type="button"
                  disabled={!canEditBranding}
                  onClick={() => {
                    setLogoDraft("");
                    setColorDraft("#06b6d4");
                    setProductName("Helix for Leads");
                  }}
                  className="mt-4 h-9 rounded-lg bg-surface-container-high px-3 text-xs text-on-surface"
                >
                  Reset official
                </button>
              </div>
              {brandError ? <p className="text-xs text-error">{brandError}</p> : null}
              {brandSaved ? (
                <p className="text-xs text-tertiary">Saved. Reload if sidebar name lags.</p>
              ) : null}
              {!canEditBranding ? (
                <p className="text-xs text-outline">Viewers cannot edit workspace branding.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold text-on-surface">Quick links</h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2.5 text-xs font-medium text-on-surface transition hover:bg-surface-container-high"
                >
                  <span className={cn("material-symbols-outlined text-[18px]", l.tone)}>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 xl:col-span-7">
          <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-xl">
            <div className="flex items-center justify-between bg-surface-container p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">cable</span>
                <h2 className="text-sm font-semibold text-on-surface">Connector Health</h2>
              </div>
              <span className="font-mono text-[10px] text-outline">
                {status ? `${connectedCount} online` : "checking…"}
              </span>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {ROWS.map((row) => {
                const connected = status?.[row.key];
                return (
                  <div
                    key={row.key}
                    className="flex items-start justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-surface-container">
                        <span className="material-symbols-outlined text-[18px] text-secondary">
                          {row.icon}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{row.label}</p>
                        <p className="text-xs text-on-surface-variant">{row.hint}</p>
                      </div>
                    </div>
                    {status == null ? (
                      <span className="font-mono text-[10px] text-outline">…</span>
                    ) : connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-2 py-0.5 font-mono text-[10px] text-tertiary">
                        <span className="size-1.5 rounded-full bg-tertiary" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 font-mono text-[10px] text-error">
                        Not configured
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {org?.configured ? (
            <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-on-surface">Workspace</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Org-scoped data isolation</p>
              {!org.signedIn ? (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-outline">Not signed in.</p>
                  <Link href="/login" className="text-xs font-semibold text-primary underline">
                    Sign in
                  </Link>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-on-surface">
                      {org.org?.orgName ?? "No workspace"}
                    </p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {org.user?.email} · {org.org?.role}
                    </p>
                  </div>
                  {webhookUrl ? (
                    <div>
                      <p className="font-mono text-[10px] tracking-wider text-outline uppercase">
                        GHL webhook (this workspace)
                      </p>
                      <code className="mt-1 block truncate rounded-lg bg-surface-container-lowest px-3 py-2 font-mono text-[11px] text-secondary">
                        {webhookUrl}
                      </code>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-on-surface">API Keys</h2>
              <button
                type="button"
                onClick={() => setKeysOpen(true)}
                className="rounded bg-surface-container-high px-2 py-1 font-mono text-[10px] text-on-surface"
              >
                Expand
              </button>
            </div>
            <ApiKeysForm initialFields={KEYS_LEADS} />
          </div>

          <div className="rounded-xl bg-surface-container-low p-5 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold text-on-surface">Desk Operations</h2>
            <DeskOpsForm />
          </div>
        </div>
      </div>

      {keysOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-container-low p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface">Desk API Keys</h2>
              <button
                type="button"
                onClick={() => setKeysOpen(false)}
                className="rounded p-1 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ApiKeysForm initialFields={KEYS_LEADS} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
