import { DeskRefresher } from "@/components/ask-ai-section";
import { BrandForm } from "@/components/brand-form";
import { getBrand } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const brand = await getBrand();
  return (
    <>
      <DeskRefresher />
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Brand voice</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {brand.name}
          {brand.handle ? ` · ${brand.handle}` : ""}. These rules steer the co-pilot and the readiness score. They do not publish anything.
        </p>
      </header>
      <BrandForm brand={brand} />
    </>
  );
}
