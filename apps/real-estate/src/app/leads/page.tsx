import { LeadsWorkspace } from "@/components/leads-workspace";
import { isCold } from "@/lib/outreach";
import { listLeads } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const [leads, sp] = await Promise.all([listLeads(), searchParams]);
  const hot = leads.filter((l) => l.buyer.tier === "hot").length;
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const coldIds = leads.filter((l) => isCold(l, now)).map((l) => l.id);
  const initial = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {leads.length} buyers · {hot} hot · scored 0–100 from budget, timeline, financing, specificity and engagement
        </p>
      </header>
      {leads.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">No buyers yet.</p>
      ) : (
        <LeadsWorkspace leads={leads} coldIds={coldIds} initial={initial} now={now} />
      )}
    </>
  );
}
