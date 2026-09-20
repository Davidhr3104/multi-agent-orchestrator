"use client";

import { useEffect, useState, type FormEvent } from "react";

type KeyField = {
  name: string;
  label: string;
  hint: string;
  stub?: boolean;
};

type KeyRow = KeyField & {
  configured: boolean;
  masked: string | null;
};

export function ApiKeysForm({ initialFields = [] }: { initialFields?: KeyField[] }) {
  const [keys, setKeys] = useState<KeyRow[]>(() =>
    initialFields.map((field) => ({ ...field, configured: false, masked: null }))
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [persist, setPersist] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings/keys");
    const data = (await res.json()) as { keys?: KeyRow[]; persist?: string };
    setKeys(data.keys ?? []);
    setPersist(data.persist ?? "");
    setDraft({});
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not save keys.");
      return;
    }
    const data = (await res.json()) as { keys?: KeyRow[]; persist?: string };
    setKeys(data.keys ?? []);
    setPersist(data.persist ?? "");
    setDraft({});
    setMessage("Saved on this desk. Values are not shown again.");
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void save(e)}>
      <div>
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="mt-1 text-xs opacity-70">
          Paste keys here instead of editing <span className="font-mono">.env</span>. They stay on the
          server. Empty fields keep the current value. Production on Vercel still needs the same keys in
          the project settings if the instance is cold.
          {persist ? ` Store: ${persist}.` : ""}
        </p>
      </div>
      {keys.length === 0 ? <p className="text-xs opacity-60">Loading keys…</p> : null}
      {keys.map((row) => (
        <label className="block space-y-1" htmlFor={row.name} key={row.name}>
          <span className="flex items-center justify-between gap-2 text-sm font-medium">
            {row.label}
            <span className={`text-xs ${row.configured ? "text-emerald-400" : "opacity-60"}`}>
              {row.configured ? `Saved ${row.masked}` : "Not set"}
            </span>
          </span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-current/15 bg-transparent px-3 font-mono text-xs outline-none"
            id={row.name}
            name={row.name}
            onChange={(e) => setDraft((d) => ({ ...d, [row.name]: e.target.value }))}
            placeholder={row.configured ? "••••••••  (leave blank to keep)" : `Paste ${row.name}`}
            spellCheck={false}
            type="password"
            value={draft[row.name] ?? ""}
          />
          <span className="block text-xs opacity-60">
            {row.hint}
            {row.stub ? " Stub — saving does not enable live writes." : ""}
          </span>
        </label>
      ))}
      {message ? <p className="text-xs opacity-80">{message}</p> : null}
      <button
        className="rounded-lg border border-current/20 px-4 py-2 text-sm font-medium"
        disabled={saving}
        type="submit"
      >
        {saving ? "Saving…" : "Save API keys"}
      </button>
    </form>
  );
}
