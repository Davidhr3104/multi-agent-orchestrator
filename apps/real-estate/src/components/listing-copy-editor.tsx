"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { ListingCopy } from "@/lib/listing-copy";
import type { ApprovedListingCopy } from "@/lib/types";
import { cn } from "@/lib/utils";

type Key = ListingCopy["key"];
type Texts = Record<Key, string>;
type Cost = { inputTokens: number; outputTokens: number; estUsd: number };

const LABEL: Record<Key, string> = { portal: "Portal listing", social: "Social post", message: "Short message" };
const KEYS: Key[] = ["portal", "social", "message"];
const BTN = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/** Listing copy the agent edits and approves. Claude writes from the listing's own fields; without a key the template is used. */
export function ListingCopyEditor({ propertyId, template, approved, claude }: { propertyId: string; template: ListingCopy[]; approved: ApprovedListingCopy | null; claude: boolean }) {
  const initial: Texts = approved
    ? { portal: approved.portal, social: approved.social, message: approved.message }
    : (Object.fromEntries(template.map((c) => [c.key, c.text])) as Texts);
  const [texts, setTexts] = useState<Texts>(initial);
  const [writer, setWriter] = useState<"template" | "claude">(approved?.writer ?? "template");
  const [saved, setSaved] = useState<ApprovedListingCopy | null>(approved);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<string | null>(claude ? null : "Template copy — Claude isn't connected (no Anthropic API key on this server).");
  const [cost, setCost] = useState<Cost | null>(null);
  const [busy, setBusy] = useState<"ai" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Key | null>(null);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/listing-copy`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) throw new Error((body?.error as string) ?? `Request failed (${res.status})`);
    return body ?? {};
  }

  async function generate() {
    if (dirty && !window.confirm("Replace your edits with a new draft?")) return;
    setBusy("ai");
    setError(null);
    try {
      const r = (await post({ action: "generate" })) as { engine: "claude" | "template"; copy: ListingCopy[]; note?: string; cost?: Cost };
      setTexts(Object.fromEntries(r.copy.map((c) => [c.key, c.text])) as Texts);
      setWriter(r.engine);
      setNote(r.note ?? null);
      setCost(r.cost ?? null);
      setDirty(r.engine === "claude" || !!saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      const r = (await post({ action: "approve", copy: texts, writer })) as { approved: ApprovedListingCopy };
      setSaved(r.approved);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function copy(k: Key) {
    try {
      await navigator.clipboard.writeText(texts[k]);
      setCopied(k);
      setTimeout(() => setCopied((c) => (c === k ? null : c)), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1",
            writer === "claude" ? "bg-orange-500/10 text-orange-300 ring-orange-500/30" : "bg-slate-500/15 text-slate-300 ring-slate-400/30"
          )}
        >
          {writer === "claude" ? "Written by Claude from this listing's fields" : "Template — built from this listing's fields"}
        </span>
        {saved && !dirty ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
            <CheckCircle2 className="size-3.5" aria-hidden /> Approved by {saved.approvedBy} · {new Date(saved.approvedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        ) : dirty ? (
          <span className="text-[11px] text-amber-300">Not approved yet — review and edit before approving.</span>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!claude || !!busy}
            title={claude ? "Claude writes from the fields above only" : "Needs an Anthropic API key on the server"}
            className={cn(BTN, "border border-border text-foreground hover:bg-accent")}
          >
            {busy === "ai" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-primary" aria-hidden />} Write with Claude
          </button>
          <button type="button" onClick={() => void approve()} disabled={!!busy || (!!saved && !dirty)} className={cn(BTN, "bg-primary text-primary-foreground hover:brightness-110")}>
            {busy === "approve" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Approve copy
          </button>
        </span>
      </div>
      {note ? <p className="text-[11px] text-muted-foreground">{note}</p> : null}
      {cost ? (
        <p className="tabular font-mono text-[11px] text-muted-foreground">
          {cost.inputTokens + cost.outputTokens} tokens · ≈ {usd(cost.estUsd)} estimated
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-3">
        {KEYS.map((k) => (
          <div key={k} className="flex flex-col rounded-lg border border-border bg-background/40">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <label htmlFor={`copy-${k}`} className="text-xs font-semibold text-foreground">
                {LABEL[k]}
              </label>
              <button
                type="button"
                onClick={() => void copy(k)}
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {copied === k ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                {copied === k ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              id={`copy-${k}`}
              value={texts[k]}
              onChange={(e) => {
                setTexts({ ...texts, [k]: e.target.value });
                setDirty(true);
              }}
              rows={k === "portal" ? 10 : 6}
              className="flex-1 resize-y bg-transparent px-3 py-2.5 text-xs leading-relaxed text-foreground/90 focus-visible:outline-none"
            />
          </div>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
