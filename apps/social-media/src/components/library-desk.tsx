"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { LibraryAsset } from "@/lib/types";

export function LibraryDesk({ assets }: { assets: LibraryAsset[] }) {
  const router = useRouter();
  const [folder, setFolder] = useState("All");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newFolder, setNewFolder] = useState("General");
  const [tags, setTags] = useState("");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<LibraryAsset["kind"]>("image");

  const [query, setQuery] = useState("");
  const folders = useMemo(() => ["All", ...new Set(assets.map((asset) => asset.folder))], [assets]);
  const shown = assets.filter((asset) => {
    if (folder !== "All" && asset.folder !== folder) return false;
    const blob = `${asset.name} ${asset.tags.join(" ")} ${asset.prompt ?? ""} ${asset.folder}`.toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => blob.includes(word));
  });

  async function run(id: string, body: unknown, message: string) {
    setBusy(id);
    setError(null);
    try {
      await postJson("/api/library", body);
      if (id === "add") {
        setName("");
        setUrl("");
        setPrompt("");
        setTags("");
      }
      notifyDesk(message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const field = "rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      <label className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase" htmlFor="library-search">
        Search
        <input id="library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, tag, folder or prompt text" className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none" />
      </label>
      <p className="-mt-4 text-xs text-muted-foreground">Matches the name, tags, folder and prompt text saved on the asset. It does not look at the picture.</p>
      <div className="flex flex-wrap gap-2">
        {folders.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={folder === item}
            onClick={() => setFolder(item)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${folder === item ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {shown.length ? (
        <ul className="columns-1 gap-3 sm:columns-2 lg:columns-3">
          {shown.map((asset) => (
            <li key={asset.id} className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card/80">
              <div className="group relative">
                {asset.url && (asset.kind === "image" || asset.kind === "logo") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-muted/40 text-xs text-muted-foreground">{asset.kind}</div>
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-black/70 p-3 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  <p>{asset.kind}</p>
                  <p>{asset.approved ? "Brand approved" : "Not brand approved"}</p>
                  <p className="truncate">{asset.folder}</p>
                </div>
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{asset.tags.join(", ") || asset.folder}</p>
                </div>
                <button
                  type="button"
                  disabled={busy === asset.id}
                  onClick={() => void run(asset.id, { action: "approve", id: asset.id, approved: !asset.approved }, asset.approved ? "Cleared brand approval." : "Marked approved by the brand.")}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${asset.approved ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {asset.approved ? "Brand approved" : "Mark approved"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">This folder is empty.</p>
      )}

      <div
        className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          const stem = file.name.replace(/\.[^.]+$/, "");
          setName(stem);
          setTags(stem.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4).join(", "));
          setKind(file.type.startsWith("video") ? "video" : "image");
          setError("The file stays on this computer. Paste an https link to store it. Tags came from the file name, not an image model.");
        }}
      >
        Drop a file to name it and suggest tags. This desk stores an https link, not the file.
      </div>

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Add a file or a prompt</h2>
        <p className="mt-1 text-xs text-muted-foreground">Canva is not connected. Export from canva.com and paste an https link. A prompt is stored as text — this desk does not generate the image.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Asset name" />
          <input className={field} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder" aria-label="Folder" />
          <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" aria-label="Tags" />
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as LibraryAsset["kind"])} aria-label="Kind">
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="logo">Logo</option>
            <option value="prompt">Prompt only</option>
          </select>
          <input className={`${field} sm:col-span-2`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="File URL" />
          <textarea className={`${field} sm:col-span-2`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Optional image prompt" rows={2} aria-label="Prompt" />
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={() =>
            void run(
              "add",
              { name, folder: newFolder, tags: tags.split(","), url, prompt, kind },
              "Added to the library. It is not brand-approved until you mark it."
            )
          }
          className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {busy === "add" ? "Adding…" : "Add to library"}
        </button>
      </section>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
