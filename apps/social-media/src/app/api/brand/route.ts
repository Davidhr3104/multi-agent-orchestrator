import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { getBrand, updateBrand } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ brand: await getBrand() });
}

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { voice?: unknown; avoid?: unknown; directives?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined);
  try {
    const brand = await updateBrand({
      voice: list(body.voice),
      avoid: list(body.avoid),
      directives: typeof body.directives === "string" ? body.directives : undefined,
    });
    return Response.json({ brand });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
