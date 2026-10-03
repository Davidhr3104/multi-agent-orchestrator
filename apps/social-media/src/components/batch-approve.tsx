"use client";

import { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { channelLabel, PILLAR_LABEL } from "@/lib/format";
import type { Channel, Pillar } from "@/lib/types";

type Row = { channel: Channel; pillar: Pillar; scheduledFor: string; status: string; score: number };

const CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];
const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

/** Approves perfect in-review posts that match channel, pillar and a date window. */
export function BatchApprove({ rows }: { rows: Row[] }) {
  const [channel, setChannel] = useState<string>("");
  const [pillar, setPillar] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = useMemo(
    () =>
      rows.filter((row) => {
        if (row.status !== "needs_review" || row.score !== 100) return false;
        if (channel && row.channel !== channel) return false;
        if (pillar && row.pillar !== pillar) return false;
        const day = row.scheduledFor.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      }).length,
    [rows, channel, pillar, from, to]
  );

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ approved: string[]; stepped: string[] }>("/api/posts/bulk-approve", {
        channel: channel || null,
        pillar: pillar || null,
        from: from || null,
        to: to || null,
      });
      const approved = data.approved.length;
      const stepped = data.stepped.length;
      const parts = [
        approved ? `Approved ${approved} post${approved === 1 ? "" : "s"} at 100.` : "",
        stepped ? `Sent ${stepped} to the client for the second sign-off.` : "",
      ].filter(Boolean);
      notifyDesk(parts.join(" ") || "No matching post in review has a score of 100.", [...data.approved, ...data.stepped]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const field = "rounded-lg border border-input bg-background/60 px-2 py-2 text-xs text-foreground";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Channel
        <select className={`mt-1 block ${field}`} value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Batch channel">
          <option value="">Any</option>
          {CHANNELS.map((item) => (
            <option key={item} value={item}>
              {channelLabel(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Pillar
        <select className={`mt-1 block ${field}`} value={pillar} onChange={(e) => setPillar(e.target.value)} aria-label="Batch pillar">
          <option value="">Any</option>
          {PILLARS.map((item) => (
            <option key={item} value={item}>
              {PILLAR_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        From
        <input type="date" className={`mt-1 block ${field}`} value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        To
        <input type="date" className={`mt-1 block ${field}`} value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={busy || count === 0}
        onClick={() => void run()}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
      >
        <CheckCheck className="size-4" aria-hidden />
        {busy ? "Approving…" : `Approve matching 100/100 (${count})`}
      </button>
      <p className="w-full text-xs text-muted-foreground">Dates use the UTC day on the scheduled time.</p>
      {error ? (
        <p role="alert" className="w-full text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
