import { createReorderRequest, listReorders } from "@/lib/store";
import { deskWriteDenied } from "@/lib/ai-desk";

export const runtime = "nodejs";

export async function GET() {
  const reorders = await listReorders();
  return Response.json({ reorders });
}

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const productId = (body as { productId?: string } | null)?.productId;
  if (!productId) {
    return Response.json({ error: "productId required" }, { status: 400 });
  }
  const reorder = await createReorderRequest(productId);
  if (!reorder) return Response.json({ error: "Product not found" }, { status: 404 });
  return Response.json({ reorder });
}
