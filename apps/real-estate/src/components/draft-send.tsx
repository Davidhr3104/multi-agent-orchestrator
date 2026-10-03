"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Mail, MessageCircle, Smartphone, Sparkles } from "lucide-react";
import type { Delivery } from "@/lib/types";
import { cn } from "@/lib/utils";

type Channel = "email" | "sms" | "whatsapp";
const CH: { value: Channel; label: string; icon: typeof Mail }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: Smartphone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];
const BTN = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const refresh = () => window.dispatchEvent(new CustomEvent("helix:desk-refresh"));

/** Claude rewrites a pending alert from the computed match; the fit numbers and "why" stay as computed. */
export function PersonalizeButton({ draftId, claude }: { draftId: string; claude: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const tone = localStorage.getItem("helix-re:draft-tone") ?? undefined;
      const res = await fetch(`/api/outreach/${encodeURIComponent(draftId)}/personalize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tone }) });
      const body = (await res.json().catch(() => null)) as { updated?: boolean; note?: string; error?: string; cost?: { estUsd: number } | null } | null;
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setMsg(body?.updated ? `Rewritten by Claude${body.cost ? ` · ≈ ${usd(body.cost.estUsd)} estimated` : ""}. Still waiting for your approval.` : (body?.note ?? "Kept the template wording."));
      if (body?.updated) refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={!claude || busy}
        title={claude ? "Claude explains the computed match and writes a personal alert" : "Needs an Anthropic API key on the server"}
        className={cn(BTN, "min-h-10 border border-border px-4 text-sm text-foreground hover:bg-accent")}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-primary" aria-hidden />} Personalize with Claude
      </button>
      {msg ? <span className="max-w-xs text-right text-[11px] text-muted-foreground">{msg}</span> : null}
    </span>
  );
}

/**
 * Sending an approved draft: one button per channel, each asking for confirmation with the recipient spelled out.
 * A channel without credentials says so and offers to copy the message instead.
 */
export function SendDraftControls({
  draftId,
  leadName,
  email,
  phone,
  subject,
  body,
  ready,
  deliveries,
}: {
  draftId: string;
  leadName: string;
  email: string;
  phone?: string;
  subject: string;
  body: string;
  ready: Record<Channel, boolean>;
  deliveries: Delivery[];
}) {
  const [busy, setBusy] = useState<Channel | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function send(channel: Channel, to: string) {
    const label = CH.find((c) => c.value === channel)!.label;
    if (!window.confirm(`Send this message to ${leadName} by ${label} (${to}) now?\n\nThis really sends it. It can't be unsent.`)) return;
    setBusy(channel);
    setMsg(null);
    try {
      const res = await fetch(`/api/outreach/${encodeURIComponent(draftId)}/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, confirm: true }) });
      const r = (await res.json().catch(() => null)) as { sent?: boolean; error?: string; provider?: string; providerId?: string } | null;
      if (!res.ok || !r?.sent) throw new Error(r?.error ?? `Not sent (${res.status}).`);
      setMsg({ ok: true, text: `Sent by ${label} via ${r.provider === "resend" ? "Resend" : "Twilio"} · id ${r.providerId}` });
      refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Not sent." });
    } finally {
      setBusy(null);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CH.map(({ value, label, icon: Icon }) => {
        const to = value === "email" ? email : phone;
        const done = deliveries.find((d) => d.channel === value);
        if (done)
          return (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/40">
              <Check className="size-3.5" aria-hidden /> {label} sent
            </span>
          );
        const why = !to ? `No ${value === "email" ? "email" : "phone"} on file` : !ready[value] ? `${label} isn't connected on this server` : "";
        return (
          <button
            key={value}
            type="button"
            disabled={!!busy || !!why}
            title={why || `Send by ${label} to ${to}`}
            onClick={() => to && void send(value, to)}
            className={cn(BTN, "border border-border text-foreground hover:bg-accent")}
          >
            {busy === value ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
            {why && to ? `${label}: not connected` : `Send ${label}`}
          </button>
        );
      })}
      <button type="button" onClick={() => void copyText()} className={cn(BTN, "text-primary hover:bg-primary/10")}>
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy message"}
      </button>
      {msg ? (
        <span role={msg.ok ? "status" : "alert"} className={cn("basis-full text-[11px]", msg.ok ? "text-emerald-300" : "text-rose-300")}>
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
