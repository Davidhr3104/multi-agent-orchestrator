import { patchInquiry } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = await patchInquiry(id, { status: "resolved" });
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });
  return Response.json({ inquiry });
}
