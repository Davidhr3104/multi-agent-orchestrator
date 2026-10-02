"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto max-w-lg rounded-2xl border border-rose-400/25 bg-card/80 px-6 py-10 text-center">
      <TriangleAlert className="mx-auto size-8 text-rose-300" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-foreground">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing was changed on your desk. It may be a dropped connection — try again, or go back to the dashboard.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <RefreshCw className="size-4" aria-hidden /> Try again
        </button>
        <Link href="/" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-accent">
          Dashboard
        </Link>
      </div>
    </section>
  );
}
