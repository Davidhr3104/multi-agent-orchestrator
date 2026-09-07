import { listAiLogs } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const logs = await listAiLogs();
  return Response.json({ logs });
}
