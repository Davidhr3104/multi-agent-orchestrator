"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { HandCoins, Pencil } from "lucide-react";
import { money } from "@/components/bits";
import { RIBBON_CARD } from "@/components/ribbon-kpi";

const compactMoney = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `$${Math.round(n / 1000)}k` : money(n));

export const RATE_KEY = "helix-re:commission-rate";
const EVENT = "helix:commission-rate";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCommissionRate(): [number | null, (r: number | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(RATE_KEY),
    () => null
  );
  const n = raw === null ? NaN : Number(raw);
  const rate = Number.isFinite(n) && n > 0 && n <= 20 ? n : null;
  const set = (r: number | null) => {
    if (r === null) localStorage.removeItem(RATE_KEY);
    else localStorage.setItem(RATE_KEY, String(r));
    window.dispatchEvent(new Event(EVENT));
  };
  return [rate, set];
}

export function CommissionRateField() {
  const [rate, setRate] = useCommissionRate();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (rate ? String(rate) : "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.replace(",", "."));
        if (value.trim() === "") setRate(null);
        else if (Number.isFinite(n) && n > 0 && n <= 20) setRate(n);
        setDraft(null);
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor="settings-rate" className="text-xs text-muted-foreground">
        Commission rate
      </label>
      <input
        id="settings-rate"
        inputMode="decimal"
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="not set"
        className="h-9 w-20 rounded-md border border-input bg-background/60 px-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <span className="text-xs text-muted-foreground">%</span>
      <button type="submit" className="h-9 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-accent">
        Save
      </button>
    </form>
  );
}

/**
 * Commission in pipeline = the agent's own rate × the list price of active and reserved listings. Helix
 * doesn't know the rate, so nothing is shown until the agent types it in (kept in this browser only).
 */
export function CommissionKpi({ listValue, listings }: { listValue: number; listings: number }) {
  const [rate, setRate] = useCommissionRate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function save(e: FormEvent) {
    e.preventDefault();
    const n = Number(draft.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 20) {
      setRate(n);
      setEditing(false);
    }
  }

  return (
    <div className={RIBBON_CARD}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="truncate text-[10px] font-semibold tracking-[0.12em] uppercase">Commission</span>
        <HandCoins className="size-[18px] shrink-0 text-primary" aria-hidden />
      </div>
      <div>
        {editing ? (
          <form onSubmit={save} className="flex h-10 items-center gap-1.5">
            <label htmlFor="commission-rate" className="sr-only">
              Your commission rate, percent
            </label>
            <input
              id="commission-rate"
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 3"
              className="h-8 w-16 rounded-md border border-input bg-background/60 px-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">%</span>
            <button type="submit" className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-8 px-1.5 text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </form>
        ) : (
          <p className="flex items-center gap-2">
            <span className="tabular font-heading text-[32px] leading-10 font-semibold tracking-tight text-foreground">{rate ? compactMoney(Math.round((listValue * rate) / 100)) : "—"}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(rate ? String(rate) : "");
                setEditing(true);
              }}
              aria-label={rate ? `Change your commission rate, now ${rate}%` : "Set your commission rate"}
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-primary"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          </p>
        )}
        <div className="mt-2 flex min-h-7 items-center rounded bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
          <span className="truncate">{rate ? `${rate}% of ${money(listValue)} · ${listings} active + reserved` : "In pipeline · set your rate — Helix won't guess it"}</span>
        </div>
      </div>
    </div>
  );
}