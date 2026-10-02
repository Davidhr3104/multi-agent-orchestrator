import { PropertiesWorkspace } from "@/components/properties-workspace";
import { listProperties } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const [props, sp] = await Promise.all([listProperties(), searchParams]);
  const initial = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const count = (s: string) => props.filter((p) => p.status === s).length;
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {props.length} properties · {count("active")} active · {count("reserved")} reserved · {count("draft")} draft · {count("sold")} sold
        </p>
      </header>
      {props.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">No properties yet.</p>
      ) : (
        <PropertiesWorkspace props={props} initial={initial} />
      )}
    </>
  );
}
