import type { HowToUseGuide } from "@helix/help";
import { cn } from "@/lib/utils";

export function HowToUsePanel({
  guide,
  accentClass = "text-primary",
  panelClass,
}: {
  guide: HowToUseGuide;
  accentClass?: string;
  panelClass?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className={cn("text-xs font-semibold tracking-wider uppercase", accentClass)}>
          {guide.product}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{guide.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.overview}</p>
      </div>

      {guide.videoSrc ? (
        <section
          className={cn(
            "glass-panel space-y-3 overflow-hidden rounded-xl border border-border p-4 sm:p-5",
            panelClass
          )}
        >
          <h2 className="text-xs font-semibold tracking-wider text-primary uppercase">
            {guide.videoTitle ?? "Walkthrough"}
          </h2>
          <div className="overflow-hidden rounded-lg border border-border bg-black/80">
            <video
              className="aspect-video w-full"
              controls
              playsInline
              preload="metadata"
              src={guide.videoSrc}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Watch the desk tour, then follow the steps below in your workspace.
          </p>
        </section>
      ) : null}

      <section className={cn("glass-panel space-y-4 rounded-xl border border-border p-6", panelClass)}>
        <h2 className="text-xs font-semibold tracking-wider text-primary uppercase">Steps</h2>
        <ol className="space-y-4">
          {guide.steps.map((step) => (
            <li key={step.title} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className={cn(
          "rounded-xl border border-amber-500/30 border-l-[3px] border-l-amber-500 bg-amber-500/5 p-5",
          panelClass
        )}
      >
        <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-300">HITL tip</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.hitlTip}</p>
      </section>

      <section className={cn("glass-panel space-y-3 rounded-xl border border-border p-6", panelClass)}>
        <h2 className="text-xs font-semibold tracking-wider text-primary uppercase">Shortcuts</h2>
        <ul className="space-y-2">
          {guide.shortcuts.map((row) => (
            <li key={row.keys} className="flex flex-wrap items-baseline gap-2 text-sm">
              <kbd className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                {row.keys}
              </kbd>
              <span className="text-muted-foreground">{row.action}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
