"use client";

import { useEffect, useState, type FormEvent } from "react";

type DeskStatus = {
  empty?: boolean;
  demo?: boolean;
  store?: string;
  count?: number;
};

export function DeskOpsForm() {
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [busy, setBusy] = useState<"demo" | "empty" | null>(null);
  const [deskMessage, setDeskMessage] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  async function loadDesk() {
    const res = await fetch("/api/settings/desk");
    if (!res.ok) return;
    setStatus((await res.json()) as DeskStatus);
  }

  async function loadOperator() {
    const res = await fetch("/api/operator");
    if (!res.ok) return;
    const data = (await res.json()) as { configured?: boolean; operator?: boolean };
    setConfigured(Boolean(data.configured));
    setUnlocked(Boolean(data.operator));
  }

  useEffect(() => {
    void loadDesk();
    void loadOperator();
  }, []);

  async function deskAction(action: "demo" | "empty") {
    setBusy(action);
    setDeskMessage(null);
    const res = await fetch("/api/settings/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (!res.ok) {
      setDeskMessage("Could not update desk data.");
      return;
    }
    setStatus((await res.json()) as DeskStatus);
    setDeskMessage(action === "demo" ? "Demo catalog loaded. Refresh other pages." : "Desk cleared locally. Supabase was not wiped.");
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockMessage(null);
    const res = await fetch("/api/operator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyDraft }),
    });
    setUnlocking(false);
    if (!res.ok) {
      setUnlockMessage("Unlock failed.");
      return;
    }
    setKeyDraft("");
    setUnlocked(true);
    setConfigured(true);
    setUnlockMessage("Operator session unlocked on this browser.");
  }

  const label = status == null
    ? "Checking…"
    : status.empty
      ? "Empty"
      : status.demo
        ? "Demo catalog"
        : "Live data";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Desk data</h2>
          <p className="mt-1 text-xs opacity-70">
            Desks start empty. Load demo catalog only for walkthroughs. Clear removes the local
            file and memory — it does not delete Supabase.
            {status?.store ? ` Store: ${status.store}.` : ""}
            {status?.count != null ? ` Rows: ${status.count}.` : ""}
          </p>
        </div>
        <p className="text-sm">
          Status: <span className="font-medium">{label}</span>
        </p>
        {deskMessage ? <p className="text-xs opacity-80">{deskMessage}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-current/20 px-4 py-2 text-sm font-medium"
            disabled={busy !== null}
            onClick={() => void deskAction("demo")}
            type="button"
          >
            {busy === "demo" ? "Loading…" : "Load demo catalog"}
          </button>
          <button
            className="rounded-lg border border-current/20 px-4 py-2 text-sm font-medium"
            disabled={busy !== null}
            onClick={() => void deskAction("empty")}
            type="button"
          >
            {busy === "empty" ? "Clearing…" : "Clear desk"}
          </button>
        </div>
      </div>

      <form className="space-y-3" onSubmit={(e) => void unlock(e)}>
        <div>
          <h2 className="text-sm font-semibold">Operator unlock</h2>
          <p className="mt-1 text-xs opacity-70">
            {configured
              ? unlocked
                ? "HITL and CRM writes are unlocked in this browser."
                : "Operator key is set. Unlock here before Confirm / Approve / Send to CRM."
              : "No operator key yet — HITL stays open on this laptop. Paste HELIX_OPERATOR_KEY above, save, then unlock."}
          </p>
        </div>
        <input
          autoComplete="off"
          className="h-9 w-full rounded-lg border border-current/15 bg-transparent px-3 font-mono text-xs outline-none"
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="Paste operator key to unlock"
          spellCheck={false}
          type="password"
          value={keyDraft}
        />
        {unlockMessage ? <p className="text-xs opacity-80">{unlockMessage}</p> : null}
        <button
          className="rounded-lg border border-current/20 px-4 py-2 text-sm font-medium"
          disabled={unlocking || !keyDraft.trim()}
          type="submit"
        >
          {unlocking ? "Unlocking…" : "Unlock operator"}
        </button>
      </form>
    </div>
  );
}
