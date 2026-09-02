"use client";

import { useEffect, useState } from "react";
import { HelixPage } from "@/components/helix-page";

export default function PromptsPage() {
  const [addendum, setAddendum] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { addendum?: string }) => setAddendum(d.addendum ?? ""));
  }, []);

  async function save() {
    await fetch("/api/settings/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addendum }),
    });
    setSaved(true);
  }

  return (
    <HelixPage
      title="Prompt Playground"
      hint="Operator rules are appended to the classifier. Example: If the lead says they are a student, classify as spam."
    >
      <div className="card-bg space-y-3 rounded-xl p-5">
        <textarea
          className="h-40 w-full resize-none rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none"
          value={addendum}
          onChange={(e) => setAddendum(e.target.value)}
          placeholder="If the lead mentions they are a student, classify as spam."
        />
        <button
          type="button"
          className="rounded-md bg-[#38bdf8] px-3 py-1.5 text-sm font-semibold text-slate-900"
          onClick={() => void save()}
        >
          Save rules
        </button>
        {saved ? <p className="text-xs text-emerald-400">Saved. Next classify uses these rules.</p> : null}
      </div>
    </HelixPage>
  );
}
