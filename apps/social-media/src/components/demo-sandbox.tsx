"use client";

import { useState } from "react";

const SAMPLE = [
  { label: "Education · LinkedIn", value: "Sample +22% vs last week" },
  { label: "Product · Instagram", value: "Sample 1,240 likes" },
  { label: "Community · TikTok", value: "Sample 18k views" },
];

/** Labeled fiction for a trial walkthrough. These numbers are not this workspace. */
export function DemoSandbox() {
  const [on, setOn] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="engagement-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="engagement-heading" className="text-lg font-semibold text-foreground">
          Engagement
        </h2>
        <button type="button" onClick={() => setOn((value) => !value)} className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary">
          {on ? "Hide sample sandbox" : "Load sample sandbox"}
        </button>
      </div>
      {on ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Sample sandbox. These figures are invented for a trial walkthrough. They are not Lumen Roasters, Harbor Goods, or any connected account.
          </p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {SAMPLE.map((row) => (
              <li key={row.label} className="rounded-lg border border-dashed border-border p-3">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{row.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{row.value}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Likes, comments, shares and reach for planned posts are not available here. Real results appear only under Real account data, read from Meta. The sample sandbox is labeled fiction and does not change the charts above.
        </p>
      )}
    </section>
  );
}
