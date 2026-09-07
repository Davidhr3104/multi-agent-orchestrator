import type { HowToUseGuide } from "@helix/help";

export function HowToUsePanel({ guide }: { guide: HowToUseGuide }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#D4AF37] uppercase">{guide.product}</p>
        <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-white">{guide.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{guide.overview}</p>
      </div>

      {guide.videoSrc ? (
        <section className="glass-card space-y-3 overflow-hidden rounded-2xl p-4 sm:p-5">
          <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            {guide.videoTitle ?? "Walkthrough"}
          </h2>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/80">
            <video
              className="aspect-video w-full"
              controls
              playsInline
              preload="metadata"
              src={guide.videoSrc}
            />
          </div>
          <p className="text-xs text-slate-500">
            Watch the desk tour, then follow the steps below in your workspace.
          </p>
        </section>
      ) : null}

      <section className="glass-card space-y-4 rounded-2xl p-6">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Steps</h2>
        <ol className="space-y-4">
          {guide.steps.map((step) => (
            <li key={step.title} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-[#F3F4F6]">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[#D4AF37]/25 border-l-[3px] border-l-[#D4AF37] bg-[#0A1628]/80 p-5">
        <h2 className="text-sm font-semibold text-[#D4AF37]">HITL tip</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{guide.hitlTip}</p>
      </section>

      <section className="glass-card space-y-3 rounded-2xl p-6">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Shortcuts</h2>
        <ul className="space-y-2">
          {guide.shortcuts.map((row) => (
            <li key={row.keys} className="flex flex-wrap items-baseline gap-2 text-sm">
              <kbd className="rounded border border-[#D4AF37]/30 bg-[#0A1628] px-2 py-0.5 font-mono text-[11px] text-[#D4AF37]">
                {row.keys}
              </kbd>
              <span className="text-slate-400">{row.action}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
