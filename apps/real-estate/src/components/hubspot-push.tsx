"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";

/** Pushes one buyer to HubSpot after a confirmation. Disabled, with the reason, when HUBSPOT_TOKEN isn't set. */
export function HubspotPush({ leadId, name, email, ready, pushedAt }: { leadId: string; name: string; email: string; ready: boolean; pushedAt?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function push() {
    if (!window.confirm(`Create or update ${name} (${email}) as a contact in your HubSpot account?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/hubspot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const r = (await res.json().catch(() => null)) as { pushed?: boolean; created?: boolean; contactId?: string; error?: string } | null;
      if (!res.ok || !r?.pushed) throw new Error(r?.error ?? `Not pushed (${res.status}).`);
      setMsg({ ok: true, text: `${r.created ? "Created" : "Updated"} in HubSpot · contact ${r.contactId}` });
      window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Not pushed." });
    } finally {
      setBusy(false);
    }
  }
  const why = !ready ? "HubSpot isn't connected (HUBSPOT_TOKEN not set)" : !email ? "No email on file" : "";
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void push()}
        disabled={busy || !!why}
        title={why || "Upsert this buyer in HubSpot by email"}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Users className="size-3.5 text-amber-300" aria-hidden />}
        {why && !ready ? "HubSpot: not connected" : pushedAt ? "Update in HubSpot" : "Push to HubSpot"}
      </button>
      {msg ? (
        <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[11px] text-emerald-300" : "text-[11px] text-rose-300"}>
          {msg.text}
        </span>
      ) : pushedAt ? (
        <span className="text-[11px] text-muted-foreground">In HubSpot since {new Date(pushedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      ) : null}
    </span>
  );
}
