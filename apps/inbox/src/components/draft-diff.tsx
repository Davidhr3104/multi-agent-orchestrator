export function DraftDiff({
  incoming,
  draft,
  tone,
}: {
  incoming: string;
  draft: string;
  tone: string;
}) {
  return (
    <div className="mb-3 grid gap-2 lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-surface-muted p-3">
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Original</p>
        <p className="text-[11px] leading-relaxed text-foreground/80">{incoming || "No incoming text."}</p>
      </div>
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-accent uppercase">AI draft</p>
        <p className="text-[11px] leading-relaxed text-foreground/80">{draft || "No draft yet."}</p>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">Tone</p>
        <p className="text-[11px] leading-relaxed text-foreground/80">{tone}</p>
      </div>
    </div>
  );
}
