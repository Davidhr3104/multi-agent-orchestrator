import { loadPricingBook } from "@/lib/pricing-knowledge";

export const runtime = "nodejs";

export async function GET() {
  const book = await loadPricingBook();
  return Response.json(book);
}
