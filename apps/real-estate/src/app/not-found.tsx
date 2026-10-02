import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-border bg-card/80 px-6 py-10 text-center">
      <SearchX className="mx-auto size-8 text-primary" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-foreground">Not on this desk</h1>
      <p className="mt-2 text-sm text-muted-foreground">That property, buyer or page doesn&apos;t exist — it may have been removed, or the demo was reset.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/properties" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-accent">
          Properties
        </Link>
        <Link href="/leads" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110">
          Leads
        </Link>
      </div>
    </section>
  );
}
