import { ingestInquiry } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const row = body as Record<string, unknown>;
  const customerEmail = String(row.customerEmail ?? "").trim();
  const inquiryText = String(row.inquiryText ?? "").trim();
  if (!customerEmail) return Response.json({ error: "customerEmail is required." }, { status: 400 });
  if (!inquiryText) return Response.json({ error: "inquiryText is required." }, { status: 400 });

  const inquiry = await ingestInquiry({ customerEmail, inquiryText });
  return Response.json({ inquiry });
}
