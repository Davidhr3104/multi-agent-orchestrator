import { listLeads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const leads = await listLeads();
  return Response.json({ leads });
}
