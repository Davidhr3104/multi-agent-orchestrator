import type { ReactNode } from "react";

export function HelixPage({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="helix-grid min-h-full text-slate-300">
      <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-6 px-4 py-8 sm:px-8">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          {hint ? <p className="mt-1 text-sm text-slate-400">{hint}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
