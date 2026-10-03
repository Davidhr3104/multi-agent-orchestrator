"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/types";

const EVENTS = ["post.approved", "post.internal_signoff", "post.rewritten", "post.autofix", "post.bulk_approved"];

export function WebhooksPanel({ hooks, outbox }: { hooks: WebhookEndpoint[]; outbox: WebhookDelivery[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("https://");
  const [picked, setPicked] = useState<string[]>(["post.approved"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(event: string) {
    setPicked((current) => (current.includes(event) ? current.filter((item) => item !== event) : [...current, event]));
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/webhooks", { url, events: picked });
      setUrl("https://");
      notifyDesk("Saved the webhook. Events stay in the outbox on this desk.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl rounded-xl border border-border bg-card/80 p-5" aria-labelledby="hooks-heading">
      <h2 id="hooks-heading" className="text-lg font-semibold text-foreground">
        Webhooks
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Make, n8n, Zapier, Slack, WhatsApp or Discord can be named here. This desk records the event in the outbox and does not call the address.
      </p>
      <label className="mt-3 block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        HTTPS endpoint
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {EVENTS.map((event) => (
          <button key={event} type="button" aria-pressed={picked.includes(event)} onClick={() => toggle(event)} className={`rounded-full border px-3 py-1 font-mono text-xs ${picked.includes(event) ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
            {event}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void add()} className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50">
        {busy ? "Saving…" : "Save endpoint"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
      {hooks.length ? (
        <ul className="mt-4 divide-y divide-border">
          {hooks.map((hook) => (
            <li key={hook.id} className="py-2">
              <p className="truncate font-mono text-xs text-foreground">{hook.url}</p>
              <p className="text-xs text-muted-foreground">{hook.events.join(", ")}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {outbox.length ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Outbox</h3>
          <ul className="mt-2 space-y-1">
            {outbox.slice(0, 8).map((item) => (
              <li key={item.id} className="font-mono text-xs text-muted-foreground">
                {item.event} · {item.at}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No events recorded yet.</p>
      )}
    </section>
  );
}
