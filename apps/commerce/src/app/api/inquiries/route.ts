import { listInquiries } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const inquiries = await listInquiries();
  return Response.json({ inquiries });
}
