"use client";

import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { Brand } from "@/lib/types";

function toneValue(directives: string, key: string) {
  const match = directives.match(new RegExp(`^tone:${key}:(\\d+)\\s*$`, "m"));
  return match ? Number(match[1]) : 50;
}

function lineValue(directives: string, prefix: string) {
  return directives
    .split(/\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim())
    .filter(Boolean)
    .join("\n");
}

function withPrefixed(directives: string, prefix: string, text: string) {
  const cleaned = directives
    .split(/\n/)
    .filter((line) => !line.startsWith(prefix))
    .join("\n")
    .trim();
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => `${prefix}${line.slice(0, 160)}`);
  return lines.length ? `${cleaned}\n${lines.join("\n")}`.trim() : cleaned;
}

function siteValue(directives: string) {
  const match = directives.match(/^site:(\S+)\s*$/m);
  return match?.[1] ?? "";
}

function withSite(directives: string, url: string) {
  const cleaned = directives.replace(/^site:\S+\s*$/m, "").trim();
  return url ? `${cleaned}\nsite:${url}`.trim() : cleaned;
}

function withTone(directives: string, key: string, value: number) {
  const line = `tone:${key}:${value}`;
  const pattern = new RegExp(`^tone:${key}:\\d+\\s*$`, "m");
  return pattern.test(directives) ? directives.replace(pattern, line) : `${directives.trim()}\n${line}`.trim();
}

function TagField({ label, hint, values, onChange }: { label: string; hint: string; values: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <button key={value} type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-foreground">
            {value} <span aria-hidden>×</span>
            <span className="sr-only">Remove {value}</span>
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== ",") return;
          event.preventDefault();
          const next = draft.trim().replace(/,$/, "");
          if (!next || values.includes(next)) return;
          onChange([...values, next].slice(0, 12));
          setDraft("");
        }}
        placeholder="Type a word and press Enter"
        className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BrandForm({ brand }: { brand: Brand }) {
  const [voice, setVoice] = useState(brand.voice);
  const [avoid, setAvoid] = useState(brand.avoid);
  const [directives, setDirectives] = useState(brand.directives);
  const [site, setSite] = useState(siteValue(brand.directives));
  const [notes, setNotes] = useState(lineValue(brand.directives, "kb:"));
  const [regulated, setRegulated] = useState(lineValue(brand.directives, "regulated:"));
  const [formal, setFormal] = useState(toneValue(brand.directives, "formal"));
  const [technical, setTechnical] = useState(toneValue(brand.directives, "technical"));
  const [reserved, setReserved] = useState(toneValue(brand.directives, "reserved"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let next = withTone(directives, "formal", formal);
      next = withTone(next, "technical", technical);
      next = withTone(next, "reserved", reserved);
      next = withSite(next, site.trim());
      next = withPrefixed(next, "kb:", notes);
      next = withPrefixed(next, "regulated:", regulated);
      await postJson("/api/brand", { voice, avoid, directives: next });
      setDirectives(next);
      notifyDesk("Brand voice saved. New drafts and rewrites follow it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-2xl space-y-4 rounded-xl border border-border bg-card/80 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase" htmlFor="brand-site">
        Website
        <input id="brand-site" value={site} onChange={(event) => setSite(event.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none" />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">Saved as a site: line on this desk. Helix does not open or scrape that URL.</p>
      <label className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase" htmlFor="brand-notes">
        Source notes
        <textarea id="brand-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none" />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">Pasted text only. A new draft can include the first note. Files are not uploaded.</p>
      <label className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase" htmlFor="brand-regulated">
        Regulated words
        <textarea id="brand-regulated" value={regulated} onChange={(event) => setRegulated(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none" />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">One term per line. The editor highlights them in amber, next to the avoid list in red. This is not a copyright or legal scan.</p>
      <TagField label="Voice words" hint="Press Enter to add a pill. Click a pill to remove it. These describe the tone the co-pilot should keep." values={voice} onChange={setVoice} />
      <TagField label="Words to avoid" hint="A post that uses one of these is blocked. Click the × to remove it." values={avoid} onChange={setAvoid} />
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Tone sliders</p>
        {(
          [
            ["Formal", "Casual", formal, setFormal],
            ["Technical", "Accessible", technical, setTechnical],
            ["Reserved", "Enthusiastic", reserved, setReserved],
          ] as const
        ).map(([left, right, value, set]) => (
          <label key={left} className="block text-xs text-muted-foreground">
            <span className="flex justify-between">
              <span>{left}</span>
              <span>{right}</span>
            </span>
            <input type="range" min={0} max={100} value={value} onChange={(event) => set(Number(event.target.value))} className="mt-1 w-full" />
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Saved as tone lines in the directives. They guide the co-pilot. They are not a model temperature.</p>
      </div>
      <label className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase" htmlFor="brand-directives">
        Standing directives
      </label>
      <textarea id="brand-directives" value={directives} onChange={(e) => setDirectives(e.target.value)} rows={6} maxLength={800} className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary focus:outline-none" />
      <p className="text-xs text-muted-foreground">Free text, plus lines that start with always: or never:. Example: never: emojis</p>
      <button type="submit" disabled={busy} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
        {busy ? "Saving…" : "Save brand voice"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
