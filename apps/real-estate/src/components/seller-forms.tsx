"use client";

import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { runDeskAction } from "@/lib/desk-client";
import { SELLER_STAGE_LABEL } from "@/lib/sellers";
import { SELLER_STAGES, type PropertyKind, type SellerStage } from "@/lib/types";
import { cn } from "@/lib/utils";

const field = "h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const label = "text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";
const KINDS: PropertyKind[] = ["apartment", "house", "townhouse", "loft", "penthouse"];

export function SellerStageSelect({ id, name, stage, className }: { id: string; name: string; stage: SellerStage; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(next: SellerStage) {
    if (next === stage) return;
    if (next === "lost" && !window.confirm(`Mark ${name} as lost? They'll drop off your pipeline.`)) return;
    setBusy(true);
    setError(null);
    try {
      await runDeskAction({ action: "move_seller_stage", targetIds: [id], labels: [name], params: { stage: next } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <select
        aria-label={`Stage for ${name}`}
        value={stage}
        disabled={busy}
        onChange={(e) => change(e.target.value as SellerStage)}
        className="min-h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      >
        {SELLER_STAGES.map((s) => (
          <option key={s} value={s}>
            {SELLER_STAGE_LABEL[s]}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-[11px] text-rose-300">
          {error}
        </span>
      ) : null}
    </span>
  );
}

export function AddSellerForm({ zones }: { zones: string[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const name = s("name");
    const asking = Number(s("askingPrice").replace(/[^0-9.]/g, ""));
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "owner";
    setBusy(true);
    setError(null);
    try {
      await runDeskAction({
        action: "add_seller",
        targetIds: [`seller-${slug}-${Date.now().toString(36)}`],
        labels: [name],
        params: {
          name,
          email: s("email"),
          phone: s("phone"),
          source: s("source"),
          address: s("address"),
          zone: s("zone"),
          kind: s("kind"),
          sqm: Number(s("sqm")),
          beds: Number(s("beds")),
          askingPrice: asking > 0 ? asking : null,
          notes: s("notes"),
        },
      });
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1">
        <span className={label}>Owner name</span>
        <input name="name" required maxLength={80} className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Email</span>
        <input name="email" type="email" maxLength={120} className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Phone</span>
        <input name="phone" type="tel" maxLength={40} className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Source</span>
        <input name="source" placeholder="Referral, door knock…" maxLength={40} className={field} />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className={label}>Property address</span>
        <input name="address" required maxLength={120} className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Zone</span>
        <input name="zone" required list="seller-zones" maxLength={40} className={field} />
        <datalist id="seller-zones">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </label>
      <label className="space-y-1">
        <span className={label}>Type</span>
        <select name="kind" defaultValue="apartment" className={cn(field, "capitalize")}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className={label}>Size (m²)</span>
        <input name="sqm" type="number" min={10} max={5000} required className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Bedrooms</span>
        <input name="beds" type="number" min={0} max={20} required className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Owner&apos;s asking price (optional)</span>
        <input name="askingPrice" inputMode="numeric" placeholder="e.g. 450000" className={field} />
      </label>
      <label className="space-y-1">
        <span className={label}>Notes</span>
        <input name="notes" maxLength={1000} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="size-4" aria-hidden /> {busy ? "Adding…" : "Add seller"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
