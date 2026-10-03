"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Link2, Loader2, Upload } from "lucide-react";
import { OperatorText } from "@/components/operator-text";
import { cn } from "@/lib/utils";

type Kind = "properties" | "buyers";
type Field = { key: string; label: string; required: boolean; hint: string | null };
type Preview = {
  kind: Kind;
  origin: "csv" | "sheet";
  headers: string[];
  mapping: Record<string, number | null>;
  fields: Field[];
  total: number;
  valid: number;
  errors: { row: number; messages: string[] }[];
  errorCount: number;
  sample: Record<string, string | number>[];
  willClearDemo: boolean;
  imported?: { added: number; updated: number; clearedDemo: boolean };
  error?: string;
};

const BTN = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** CSV upload or a public Google Sheet link -> column mapping -> per-row validation -> import. */
export function ImportPanel() {
  const [kind, setKind] = useState<Kind>("properties");
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null> | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const source = sheetUrl.trim() ? { sheetUrl: sheetUrl.trim() } : csv ? { csv } : null;

  async function call(commit: boolean, map: Record<string, number | null> | null) {
    if (!source) return;
    setBusy(commit ? "import" : "preview");
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, ...source, mapping: map ?? undefined, commit }) });
      const body = (await res.json().catch(() => null)) as Preview | { error?: string } | null;
      if (!res.ok && !(body && "headers" in body)) throw new Error(body?.error ?? `Request failed (${res.status})`);
      const p = body as Preview;
      setPreview(p);
      setMapping(p.mapping);
      if (p.error) setError(p.error);
      if (commit && p.imported) {
        const noun = kind === "properties" ? "listing" : "buyer";
        const msg = `Imported ${p.valid} ${noun}${p.valid === 1 ? "" : "s"} (${p.imported.added} new, ${p.imported.updated} updated)${p.errorCount ? `; ${p.errorCount} row${p.errorCount === 1 ? "" : "s"} skipped` : ""}.${p.imported.clearedDemo ? " The sample agency was removed — the desk now shows only your data." : ""}`;
        setDone(msg);
        window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message: msg, ids: [] } }));
        window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  function reset(nextKind?: Kind) {
    if (nextKind) setKind(nextKind);
    setPreview(null);
    setMapping(null);
    setError(null);
    setDone(null);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    setSheetUrl("");
    setCsv(await file.text());
  }

  const confirmImport = () => {
    if (!preview) return;
    if (preview.willClearDemo && !window.confirm("Importing replaces the sample agency: every demo listing, buyer, draft, showing and seller is removed, and the desk shows only your data from now on. Continue?")) return;
    void call(true, mapping);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="What to import">
        {(
          [
            ["properties", "Listings"],
            ["buyers", "Buyers"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => reset(k)}
            className={cn(BTN, "min-h-9 px-3", kind === k ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "border border-border text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground">
          {kind === "properties" ? "Needs address, zone, type, price, size, bedrooms and bathrooms." : "Needs a name and an email or phone."}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-border bg-background/40 p-4 hover:bg-accent/30">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileUp className="size-4 text-primary" aria-hidden /> Upload a CSV
          </span>
          <span className="text-[11px] text-muted-foreground">{fileName ? `Selected: ${fileName}` : "Exported from your MLS, CRM, Excel or Google Sheets."}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-4">
          <label htmlFor="sheet-url" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="size-4 text-primary" aria-hidden /> Google Sheets link
          </label>
          <input
            id="sheet-url"
            type="url"
            value={sheetUrl}
            onChange={(e) => {
              reset();
              setSheetUrl(e.target.value);
            }}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="min-h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <span className="text-[11px] text-muted-foreground">Publish it to the web as CSV, or share it as &ldquo;Anyone with the link can view&rdquo;. No Google sign-in needed.</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!source || !!busy} onClick={() => void call(false, mapping)} className={cn(BTN, "border border-border text-foreground hover:bg-accent")}>
          {busy === "preview" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {preview ? "Check again" : "Check the file"}
        </button>
        {preview && preview.valid > 0 ? (
          <button type="button" disabled={!!busy} onClick={confirmImport} className={cn(BTN, "bg-primary text-primary-foreground hover:brightness-110")}>
            {busy === "import" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            Import {preview.valid} valid row{preview.valid === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <OperatorText text={error} />
          </span>
        </p>
      ) : null}
      {done ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {done}
        </p>
      ) : null}

      {preview && mapping ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {preview.total} row{preview.total === 1 ? "" : "s"} found · <span className="text-emerald-300">{preview.valid} valid</span> ·{" "}
            <span className={preview.errorCount ? "text-amber-300" : ""}>{preview.errorCount} with errors</span>
            {preview.willClearDemo ? " · importing replaces the sample agency" : ""}
          </p>
          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-foreground">Column mapping</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {preview.fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-xs">
                  <span className="text-foreground">
                    {f.label}
                    {f.required ? <span className="text-rose-300"> *</span> : null}
                    {f.hint ? <span className="text-muted-foreground"> · {f.hint}</span> : null}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                    className="min-h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option value="">— not in file —</option>
                    {preview.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Changed a column? Press &ldquo;Check again&rdquo; before importing.</p>
          </fieldset>

          {preview.errors.length ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="text-xs font-semibold text-amber-200">Rows that won&apos;t be imported{preview.errorCount > preview.errors.length ? ` (first ${preview.errors.length} of ${preview.errorCount})` : ""}</p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-amber-100/90">
                {preview.errors.map((e) => (
                  <li key={e.row}>
                    <span className="tabular font-mono text-amber-300">Row {e.row}:</span> {e.messages.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.sample.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[36rem] text-xs">
                <caption className="sr-only">First valid rows as they will be imported</caption>
                <thead>
                  <tr className="text-left text-[10px] tracking-wider text-muted-foreground uppercase">
                    {Object.keys(preview.sample[0]).map((k) => (
                      <th key={k} className="px-3 py-2 font-semibold">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r, i) => (
                    <tr key={i} className="odd:bg-muted/25">
                      {Object.values(r).map((v, j) => (
                        <td key={j} className="px-3 py-1.5 text-foreground">
                          {typeof v === "number" ? v.toLocaleString("en-US") : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
