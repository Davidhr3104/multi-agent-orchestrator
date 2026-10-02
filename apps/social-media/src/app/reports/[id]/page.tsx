import Link from "next/link";
import { notFound } from "next/navigation";
import { PILLAR_LABEL } from "@/lib/format";
import { getReport } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();
  const when = new Date(report.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <header>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Calendar report</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">{report.workspaceName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{when}</p>
      </header>
      <section className="grid max-w-3xl gap-4 sm:grid-cols-4">
        {[
          ["Planned", report.total],
          ["Approved", report.approved],
          ["Score 100", report.perfect],
          ["Average", report.avgScore],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-border bg-card/80 p-4">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{value}</p>
          </article>
        ))}
      </section>
      <ul className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-card/80">
        {report.pillars.map((row) => (
          <li key={row.pillar} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-foreground">{PILLAR_LABEL[row.pillar]}</span>
            <span className="font-mono text-muted-foreground">
              {row.count} posts · avg {row.avgScore}
            </span>
          </li>
        ))}
      </ul>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{report.note}</p>
      <Link href="/analytics" className="text-sm font-semibold text-primary hover:underline">
        Back to analytics
      </Link>
    </>
  );
}
