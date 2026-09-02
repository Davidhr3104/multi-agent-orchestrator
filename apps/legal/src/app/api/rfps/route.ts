import { listRfps, getClientProfile } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const rfps = await listRfps();
  return Response.json({ rfps, clientProfile: getClientProfile() });
}
